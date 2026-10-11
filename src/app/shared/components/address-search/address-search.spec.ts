import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GooglePlacesService, PlaceDetails } from '@core/services/google-places.service';
import { AddressSearch } from './address-search';

const DETAILS: PlaceDetails = {
  placeId: 'p1',
  street: 'Plot 188, American Diya Rd',
  state: 'Federal Capital Territory',
  cityCandidates: ['Abuja', 'Durumi'],
  latitude: 9,
  longitude: 7.4,
};

describe('AddressSearch', () => {
  let fixture: ComponentFixture<AddressSearch>;
  let root: HTMLElement;
  const places = {
    suggest: vi.fn(),
    details: vi.fn(),
  };

  const input = () => root.querySelector<HTMLInputElement>('input')!;
  const type = (text: string) => {
    input().value = text;
    input().dispatchEvent(new Event('input'));
  };
  const settle = async () => {
    await vi.advanceTimersByTimeAsync(400);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    places.suggest.mockReset();
    places.details.mockReset();
    places.suggest.mockResolvedValue([
      { placeId: 'p1', primary: 'Soulmate House', secondary: 'Durumi, Abuja' },
    ]);
    places.details.mockResolvedValue(DETAILS);
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AddressSearch],
      providers: [{ provide: GooglePlacesService, useValue: places }],
    }).compileComponents();
    fixture = TestBed.createComponent(AddressSearch);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  it('passes every keystroke up so a hand-typed address is never lost', () => {
    const typed = vi.fn();
    fixture.componentInstance.valueChange.subscribe(typed);
    type('12 Adm');
    expect(typed).toHaveBeenCalledWith('12 Adm');
  });

  it('suggests places once a few characters are typed, and says they come from Google', async () => {
    type('Soulmate');
    await settle();
    expect(places.suggest).toHaveBeenCalledWith('Soulmate');
    const options = root.querySelectorAll('[role=option]');
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain('Soulmate House');
    expect(root.textContent).toContain('Powered by Google');
  });

  it('waits until typing pauses instead of searching on every key', async () => {
    type('Sou');
    type('Soul');
    type('Soulm');
    await settle();
    expect(places.suggest).toHaveBeenCalledTimes(1);
    expect(places.suggest).toHaveBeenCalledWith('Soulm');
  });

  it('fills the field and reports the place when a suggestion is picked', async () => {
    const picked = vi.fn();
    fixture.componentInstance.placeSelected.subscribe(picked);
    type('Soulmate');
    await settle();

    root.querySelector<HTMLElement>('[role=option]')!.click();
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();

    expect(picked).toHaveBeenCalledWith(DETAILS);
    expect(input().value).toBe('Plot 188, American Diya Rd');
    expect(root.querySelector('[role=listbox]')).toBeNull();
  });

  it('stays a plain text box when Google gives no suggestions', async () => {
    places.suggest.mockResolvedValue([]);
    type('Soulmate');
    await settle();
    expect(root.querySelector('[role=listbox]')).toBeNull();
  });

  it('drops a pending search when the field goes away (Angular NG0953)', async () => {
    const picked = vi.fn();
    fixture.componentInstance.placeSelected.subscribe(picked);
    type('Soulmate');
    fixture.destroy();
    await settle();
    expect(places.suggest).not.toHaveBeenCalled();
    expect(picked).not.toHaveBeenCalled();
  });
});
