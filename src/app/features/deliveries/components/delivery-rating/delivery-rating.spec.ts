import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HapticsService } from '@core/services/haptics.service';
import { ToastService } from '@core/services/toast.service';
import { DeliveryRatingService } from '../../delivery-rating.service';
import { DeliveryRatingCard } from './delivery-rating';

describe('DeliveryRatingCard', () => {
  let fixture: ComponentFixture<DeliveryRatingCard>;
  let root: HTMLElement;
  const api = { get: vi.fn(), save: vi.fn() };
  const toast = { success: vi.fn(), error: vi.fn() };

  async function render(existing: { score: number; comment: string } | null = null) {
    api.get.mockResolvedValue(existing);
    api.save.mockImplementation(async (_t: string, _s: string, rating: unknown) => rating);
    await TestBed.configureTestingModule({
      imports: [DeliveryRatingCard],
      providers: [
        { provide: DeliveryRatingService, useValue: api },
        { provide: ToastService, useValue: toast },
        {
          provide: HapticsService,
          useValue: { selection: vi.fn(), light: vi.fn(), success: vi.fn(), error: vi.fn() },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DeliveryRatingCard);
    fixture.componentRef.setInput('trackingId', 'FDL-1');
    fixture.componentRef.setInput('shipmentId', 'uuid-1');
    fixture.componentRef.setInput('courierName', 'Swift Riders');
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const radios = () => Array.from(root.querySelectorAll<HTMLInputElement>('input[type=radio]'));
  const chip = (text: string) =>
    Array.from(root.querySelectorAll<HTMLButtonElement>('.chip')).find(
      (el) => el.textContent?.trim() === text,
    ) as HTMLButtonElement;
  function choose(score: number) {
    radios()[score - 1].dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
  });

  it('asks for a rating with five labelled stars and nothing else until a star is chosen', async () => {
    await render();
    expect(root.textContent).toContain('How was your delivery?');
    expect(radios().map((r) => r.getAttribute('aria-label'))).toEqual([
      '1 out of 5, Very poor',
      '2 out of 5, Poor',
      '3 out of 5, Okay',
      '4 out of 5, Good',
      '5 out of 5, Excellent',
    ]);
    expect(root.querySelector('.rate__more')).toBeNull();
  });

  it('shows praise for a high score and problems for a low one, clearing picks across the line', async () => {
    await render();
    choose(5);
    expect(root.textContent).toContain('What went well?');
    chip('On time').click();
    fixture.detectChanges();
    expect(chip('On time').getAttribute('aria-pressed')).toBe('true');

    choose(2);
    expect(root.textContent).toContain('What could be better?');
    expect(root.querySelectorAll('.chip--on')).toHaveLength(0);
  });

  it('sends the picks and note as one comment, then shows the thank-you state', async () => {
    await render();
    choose(4);
    chip('On time').click();
    chip('Friendly courier').click();
    const note = root.querySelector('textarea') as HTMLTextAreaElement;
    note.value = 'Called before arriving';
    note.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (root.querySelector('.btn--primary') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.save).toHaveBeenCalledWith(
      'FDL-1',
      'uuid-1',
      { score: 4, comment: 'On time, Friendly courier. Called before arriving' },
      false,
    );
    expect(root.textContent).toContain('You rated Swift Riders Good');
    expect(toast.success).toHaveBeenCalled();
  });

  it('opens an existing rating in the thank-you state and edits it with an update', async () => {
    await render({ score: 3, comment: 'Arrived late' });
    expect(root.textContent).toContain('You rated Swift Riders Okay');

    (root.querySelector('.rate__edit') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect((root.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Arrived late');
    (root.querySelector('.btn--primary') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(api.save).toHaveBeenCalledWith(
      'FDL-1',
      'uuid-1',
      { score: 3, comment: 'Arrived late' },
      true,
    );
  });

  it('keeps the form and offers a retry when sending fails', async () => {
    await render();
    api.save.mockRejectedValueOnce(new Error('Network down'));
    choose(5);
    (root.querySelector('.btn--primary') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(toast.error).toHaveBeenCalled();
    expect(root.querySelector('.rate__more')).not.toBeNull();
  });
});
