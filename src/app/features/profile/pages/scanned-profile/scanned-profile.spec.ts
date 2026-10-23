import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { PublicProfileService } from './public-profile.service';
import { ScannedProfile } from './scanned-profile';

describe('ScannedProfile', () => {
  const lookup = vi.fn();
  let fixture: ComponentFixture<ScannedProfile>;
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  async function render(username: string) {
    params = new BehaviorSubject(convertToParamMap({ username }));
    await TestBed.configureTestingModule({
      imports: [ScannedProfile],
      providers: [
        provideRouter([]),
        { provide: PublicProfileService, useValue: { lookup } },
        { provide: ActivatedRoute, useValue: { paramMap: params } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ScannedProfile);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => lookup.mockReset());

  it('shows who the code belongs to and what to do next', async () => {
    lookup.mockResolvedValue({ username: 'probe', name: 'Probe Recipient', avatarUrl: null });
    await render('probe');

    expect(lookup).toHaveBeenCalledWith('probe');
    expect(text()).toContain('Probe Recipient');
    expect(text()).toContain('@probe');
    expect(text()).toContain('PR');
    expect(text()).toContain('Send a parcel');
    expect(text()).toContain('Get the app');
  });

  it('says so when nobody has that username', async () => {
    lookup.mockResolvedValue(null);
    await render('nobody');

    expect(text()).toContain("We couldn't find @nobody");
  });

  it('offers a retry when the lookup itself fails', async () => {
    lookup.mockRejectedValueOnce(new Error('offline'));
    await render('probe');
    expect(text()).toContain('Something went wrong');

    lookup.mockResolvedValue({ username: 'probe', name: 'Probe Recipient', avatarUrl: null });
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button')?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(text()).toContain('Probe Recipient');
  });
});
