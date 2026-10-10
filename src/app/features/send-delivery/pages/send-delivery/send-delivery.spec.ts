import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { HapticsService } from '@core/services/haptics.service';
import { ToastService } from '@core/services/toast.service';
import { SendDeliveryService } from '../../send-delivery.service';
import { CourierRate, SendDraft, emptyDraft } from '../../send-delivery.model';
import { SendDelivery } from './send-delivery';

const rate = (rateId: string, amount: number, deliveryWindow: string): CourierRate => ({
  rateId,
  courierName: `Courier ${rateId}`,
  logoUrl: null,
  priceLabel: `₦${amount.toLocaleString()}`,
  amount,
  deliveryWindow,
  rating: null,
  reviewCount: null,
});

function completeDraft(): SendDraft {
  const draft = emptyDraft();
  draft.parcel = {
    ...draft.parcel,
    shortDescription: 'Pixel 3',
    sizeId: 2,
    type: 'non_perishable',
    weight: 2.5,
    images: [{ id: 'img-1', link: 'data:,' }],
  };
  draft.pickup = { ...draft.pickup, address: '5 Ahmadu Bello Way', state: 'Lagos', city: '' };
  draft.dropoff = {
    ...draft.dropoff,
    fullName: 'Williams',
    phone: '+2348098765432',
    email: 'w@mail.test',
    address: '12 Aminu Kano Crescent',
    state: 'Lagos',
    city: '',
  };
  return draft;
}

describe('SendDelivery', () => {
  let fixture: ComponentFixture<SendDelivery>;
  let root: HTMLElement;
  const api = {
    categories: vi.fn().mockResolvedValue([]),
    sizes: vi.fn().mockResolvedValue([{ id: 2, label: 'Medium box' }]),
    states: vi.fn().mockResolvedValue([{ id: 25, label: 'Lagos' }]),
    cities: vi.fn().mockResolvedValue([]),
    rates: vi.fn(),
    order: vi.fn(),
    uploadImages: vi.fn(),
  };

  async function render(draft: SendDraft | null = null) {
    localStorage.clear();
    if (draft) localStorage.setItem('fardelins.send-draft', JSON.stringify(draft));
    await TestBed.configureTestingModule({
      imports: [SendDelivery],
      providers: [
        provideRouter([]),
        { provide: SendDeliveryService, useValue: api },
        { provide: AuthService, useValue: { user: signal(null) } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        {
          provide: HapticsService,
          useValue: { selection: vi.fn(), light: vi.fn(), success: vi.fn(), error: vi.fn() },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SendDelivery);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  const title = () => root.querySelector('.send__title')?.textContent?.trim();
  const press = async (label: string) => {
    const button = Array.from(root.querySelectorAll<HTMLButtonElement>('button')).find((el) =>
      el.textContent?.trim().startsWith(label),
    );
    button?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    api.rates.mockResolvedValue([
      rate('a', 2600, '2 days'),
      rate('b', 3100, '1 day'),
      rate('c', 2900, '3 days'),
    ]);
  });

  it('has three steps and stays put, naming what is missing, when Continue is pressed early', async () => {
    await render();
    expect(
      Array.from(root.querySelectorAll('.steps__label')).map((el) => el.textContent?.trim()),
    ).toEqual(['1. Parcel', '2. Route', '3. Courier']);
    await press('Continue');
    expect(title()).toBe('What are you sending?');
    expect(root.textContent).toContain("Tell us what you're sending.");
    expect(root.textContent).toContain('Add at least one photo.');
  });

  it('moves through the steps once each is complete and prices the couriers', async () => {
    await render(completeDraft());
    await press('Continue');
    expect(title()).toBe('Where is it going?');
    await press('Continue');
    expect(title()).toBe('Choose a courier');
    expect(api.rates).toHaveBeenCalled();
    expect(root.querySelectorAll('.courier')).toHaveLength(3);
  });

  it('tags a single cheapest and a single fastest courier, and no tag on a tie', async () => {
    await render(completeDraft());
    await press('Continue');
    await press('Continue');
    const tagsOf = (id: string) =>
      Array.from(root.querySelectorAll('.courier'))
        .find((el) => el.textContent?.includes(`Courier ${id}`))
        ?.querySelectorAll('.tag');
    expect(tagsOf('a')?.[0]?.textContent?.trim()).toBe('Cheapest');
    expect(tagsOf('b')?.[0]?.textContent?.trim()).toBe('Fastest');

    TestBed.resetTestingModule();
    api.rates.mockResolvedValue([rate('a', 2600, '2 days'), rate('b', 2600, '2 days')]);
    await render(completeDraft());
    await press('Continue');
    await press('Continue');
    expect(root.querySelectorAll('.tag')).toHaveLength(0);
  });

  it('keeps the newest prices when an older request finishes last', async () => {
    await render(completeDraft());
    await press('Continue');
    await press('Continue');

    let finishOld: (rates: ReturnType<typeof rate>[]) => void = () => undefined;
    api.rates
      .mockReturnValueOnce(new Promise((resolve) => (finishOld = resolve)))
      .mockResolvedValueOnce([rate('a', 5100, '1 day')]);
    await press('Courier office');
    await press('Priority');
    finishOld([rate('a', 2100, '2 days')]);
    await fixture.whenStable();
    fixture.detectChanges();

    const shown = root.querySelector('.courier__price')?.textContent;
    expect(shown).toContain((5100).toLocaleString());
    expect(shown).not.toContain((2100).toLocaleString());
  });

  it('asks for a courier before paying, then pays through Paystack', async () => {
    api.order.mockResolvedValue({ reference: 'ref-1', authorizationUrl: null });
    await render(completeDraft());
    await press('Continue');
    await press('Continue');

    await press('Pay');
    expect(api.order).not.toHaveBeenCalled();
    expect(root.textContent).toContain('Pick a courier to continue.');

    root.querySelectorAll<HTMLButtonElement>('.courier')[1].click();
    fixture.detectChanges();
    await press('Pay ₦3,100');
    expect(api.order).toHaveBeenCalledWith(
      expect.objectContaining({ rateId: 'b' }),
      expect.anything(),
    );
  });
});
