import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { AppPromoService } from '@features/app-promo/app-promo.service';
import { DeliveriesService } from './deliveries.service';
import { DeliveryRatingService } from './delivery-rating.service';
import { RatingPromptService } from './rating-prompt.service';

const parcel = (trackingId: string, status: string, createdAt: string) => ({
  trackingId,
  status,
  createdAt,
  title: trackingId,
  imageUrl: null,
  createdLabel: '',
  dropOff: null,
  etaLabel: null,
  amountLabel: null,
});

describe('RatingPromptService', () => {
  const deliveries = { list: vi.fn(), detail: vi.fn() };
  const ratings = { get: vi.fn() };
  const promoActive = signal<string | null>(null);
  let url = '/app';

  function service(): RatingPromptService {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user: signal({ id: 'u1' }) } },
        {
          provide: Router,
          useValue: {
            get url() {
              return url;
            },
          },
        },
        { provide: AppPromoService, useValue: { active: promoActive } },
        { provide: DeliveriesService, useValue: deliveries },
        { provide: DeliveryRatingService, useValue: ratings },
      ],
    });
    return TestBed.inject(RatingPromptService);
  }

  async function run(prompt: RatingPromptService): Promise<void> {
    const pending = prompt.check();
    await vi.advanceTimersByTimeAsync(1200);
    await pending;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    url = '/app';
    promoActive.set(null);
    TestBed.resetTestingModule();
    deliveries.list.mockResolvedValue([
      parcel('FDL-OLD', 'completed', '2026-10-01T10:00:00Z'),
      parcel('FDL-MOVING', 'enroute', '2026-10-07T10:00:00Z'),
      parcel('FDL-NEW', 'received', '2026-10-06T10:00:00Z'),
    ]);
    deliveries.detail.mockImplementation(async (id: string) => ({ trackingId: id }));
    ratings.get.mockResolvedValue(null);
  });

  afterEach(() => vi.useRealTimers());

  it('offers the newest handed-over parcel, never one still moving', async () => {
    const prompt = service();
    await run(prompt);
    expect(prompt.parcel()?.trackingId).toBe('FDL-NEW');
  });

  it('skips a parcel that is already rated', async () => {
    ratings.get.mockImplementation(async (id: string) =>
      id === 'FDL-NEW' ? { score: 5, comment: '' } : null,
    );
    const prompt = service();
    await run(prompt);
    expect(prompt.parcel()?.trackingId).toBe('FDL-OLD');
  });

  it('asks only once per session', async () => {
    const prompt = service();
    await run(prompt);
    prompt.finish();
    await run(prompt);
    expect(prompt.parcel()).toBeNull();
    expect(deliveries.list).toHaveBeenCalledTimes(1);
  });

  it('never asks again about a parcel the customer waved off', async () => {
    const prompt = service();
    await run(prompt);
    prompt.later();
    sessionStorage.clear();
    await run(prompt);
    expect(prompt.parcel()?.trackingId).toBe('FDL-OLD');
  });

  it('does not interrupt a send, the app promo, or the parcel page itself', async () => {
    for (const setup of [
      () => (url = '/app/send'),
      () => promoActive.set('manual'),
      () => (url = '/app/deliveries/FDL-NEW'),
    ]) {
      sessionStorage.clear();
      url = '/app';
      promoActive.set(null);
      setup();
      const prompt = service();
      await run(prompt);
      expect(prompt.parcel()).toBeNull();
      TestBed.resetTestingModule();
    }
  });

  it('tries again on the next visit when the app promo had the screen', async () => {
    promoActive.set('first-delivery');
    const prompt = service();
    await run(prompt);
    expect(prompt.parcel()).toBeNull();

    promoActive.set(null);
    await run(prompt);
    expect(prompt.parcel()?.trackingId).toBe('FDL-NEW');
  });

  it('stays silent when the lookups fail', async () => {
    deliveries.list.mockRejectedValue(new Error('offline'));
    const prompt = service();
    await run(prompt);
    expect(prompt.parcel()).toBeNull();
  });
});
