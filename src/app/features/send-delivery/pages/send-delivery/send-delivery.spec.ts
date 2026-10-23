import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { HapticsService } from '@core/services/haptics.service';
import { SavedAddressesService, SavedAddress } from '@core/services/saved-addresses.service';
import { ToastService } from '@core/services/toast.service';
import { SendDeliveryService } from '../../send-delivery.service';
import { CourierRate, SendDraft, emptyDraft } from '../../send-delivery.model';
import { StorefrontService } from '@features/storefront/storefront.service';
import { Storefront } from '@features/storefront/storefront.models';
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
  deliveriesMade: null,
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
    fullName: 'Ada Williams',
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
  const savedAddresses = signal<SavedAddress[]>([]);

  async function render(draft: SendDraft | null = null) {
    localStorage.clear();
    if (draft) localStorage.setItem('fardelins.send-draft', JSON.stringify(draft));
    await TestBed.configureTestingModule({
      imports: [SendDelivery],
      providers: [
        provideRouter([]),
        { provide: SendDeliveryService, useValue: api },
        { provide: StorefrontService, useValue: { list: vi.fn().mockResolvedValue([]) } },
        { provide: SavedAddressesService, useValue: { items: savedAddresses, load: vi.fn() } },
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
    savedAddresses.set([]);
    TestBed.resetTestingModule();
    api.rates.mockResolvedValue([
      rate('a', 2600, '2 days'),
      rate('b', 3100, '1 day'),
      rate('c', 2900, '3 days'),
    ]);
  });

  it('disables a saved address on the opposite side, whichever side selected it first', async () => {
    savedAddresses.set([
      {
        id: 'home',
        label: 'Home',
        address: '12 Durumi Road',
        state: 'Abuja',
        city: 'Durumi',
      },
    ]);
    await render();
    let page = fixture.componentInstance;
    page['currentStep'].set(2);
    fixture.detectChanges();

    await page['useSavedAddress']('pickup', 'home');
    page['toggleSavedAddress']('dropoff');
    fixture.detectChanges();
    const deliveryChip = root.querySelector<HTMLButtonElement>('#dropoff-saved-addresses .chip');
    expect(deliveryChip?.disabled).toBe(true);
    await page['useSavedAddress']('dropoff', 'home');
    expect(page['draft']().dropoff.address).toBe('');

    TestBed.resetTestingModule();
    await render();
    page = fixture.componentInstance;
    page['currentStep'].set(2);
    fixture.detectChanges();
    await page['useSavedAddress']('dropoff', 'home');
    page['toggleSavedAddress']('pickup');
    fixture.detectChanges();
    const pickupChip = root.querySelector<HTMLButtonElement>('#pickup-saved-addresses .chip');
    expect(pickupChip?.disabled).toBe(true);
    await page['useSavedAddress']('pickup', 'home');
    expect(page['draft']().pickup.address).toBe('');
  });

  it('disables a selected storefront on the opposite side too', async () => {
    const property: Storefront = {
      id: 'storefront',
      name: '',
      email: 'store@example.test',
      phone: '08012345678',
      description: null,
      website: null,
      location: {
        id: null,
        address: '7 Durumi Road',
        cityId: 7,
        stateId: 25,
        countryId: null,
        latitude: null,
        longitude: null,
        zipCode: null,
      },
      preferredCourierIds: [],
      createdAt: null,
      updatedAt: null,
    };
    await render();
    let page = fixture.componentInstance;
    page['currentStep'].set(2);
    page['properties'].set([property]);
    fixture.detectChanges();

    await page['usePropertyAddress']('pickup', property.id);
    page['toggleSavedAddress']('dropoff');
    fixture.detectChanges();
    const deliveryChip = root.querySelector<HTMLButtonElement>('#dropoff-saved-addresses .chip');
    expect(deliveryChip?.textContent?.trim()).toBe('7 Durumi Road');
    expect(deliveryChip?.disabled).toBe(true);
    await page['usePropertyAddress']('dropoff', property.id);
    expect(page['draft']().dropoff.address).toBe('');

    TestBed.resetTestingModule();
    await render();
    page = fixture.componentInstance;
    page['currentStep'].set(2);
    page['properties'].set([property]);
    fixture.detectChanges();
    await page['usePropertyAddress']('dropoff', property.id);
    page['toggleSavedAddress']('pickup');
    fixture.detectChanges();
    const pickupChip = root.querySelector<HTMLButtonElement>('#pickup-saved-addresses .chip');
    expect(pickupChip?.textContent?.trim()).toBe('7 Durumi Road');
    expect(pickupChip?.disabled).toBe(true);
    await page['usePropertyAddress']('pickup', property.id);
    expect(page['draft']().pickup.address).toBe('');
  });

  it('has three steps and stays put, naming what is missing, when Continue is pressed early', async () => {
    await render();
    expect(
      Array.from(root.querySelectorAll('.steps__label')).map((el) => el.textContent?.trim()),
    ).toEqual(['Parcel Info', 'Set Route', 'Select Courier']);
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

  it('shows delivery time, rating, reviews and deliveries made on the courier card', async () => {
    api.rates.mockResolvedValue([
      {
        ...rate('a', 3400, '2 - 3 days'),
        rating: 4.6,
        reviewCount: 256,
        deliveriesMade: 1254,
      },
      rate('b', 3500, '2 days'),
    ]);
    await render(completeDraft());
    await press('Continue');
    await press('Continue');

    const cards = root.querySelectorAll('.courier');
    const first = cards[0].textContent ?? '';
    expect(first).toContain('Delivers in 2 - 3 days');
    expect(first).toContain('4.6');
    expect(first).toContain('(256)');
    expect(first).toContain(`${(1254).toLocaleString()} Deliveries Made`);
    expect(cards[1].textContent).not.toContain('Deliveries Made');
  });

  it('searches couriers by name and loads six at a time', async () => {
    api.rates.mockResolvedValue(
      Array.from({ length: 14 }, (_, i) => rate(`${i + 1}`.padStart(2, '0'), 3000 + i, '2 days')),
    );
    await render(completeDraft());
    await press('Continue');
    await press('Continue');

    expect(root.querySelectorAll('.courier')).toHaveLength(6);
    expect(root.querySelector('.couriers__more')?.textContent).toContain('Showing 6 of 14');
    await press('Load more');
    expect(root.querySelectorAll('.courier')).toHaveLength(12);
    await press('Load more');
    expect(root.querySelectorAll('.courier')).toHaveLength(14);
    expect(
      Array.from(root.querySelectorAll('button')).some((b) => b.textContent?.includes('Load more')),
    ).toBe(false);

    const search = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'courier 07';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(root.querySelectorAll('.courier')).toHaveLength(1);
    expect(root.querySelector('.couriers__more')?.textContent).toContain('Showing 1 of 1');

    search.value = 'nothing';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(root.querySelectorAll('.courier')).toHaveLength(0);
    expect(root.textContent).toContain('No courier matches "nothing".');
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

  it('fills street, state and city from a Google place, and drops the coordinates on a hand edit', async () => {
    await render();
    // Let the page's own start-up loading finish so it cannot ask for cities mid-test.
    await new Promise((resolve) => setTimeout(resolve));
    const page = fixture.componentInstance;
    api.cities.mockResolvedValueOnce([{ id: 7, label: 'ikeja' }]);

    await page['onPlace']('dropoff', {
      placeId: 'p1',
      street: '12 Aminu Kano Crescent',
      state: 'Lagos State',
      cityCandidates: ['Lagos', 'Ikeja'],
      latitude: 6.6,
      longitude: 3.3,
    });
    expect(page['draft']().dropoff).toMatchObject({
      address: '12 Aminu Kano Crescent',
      state: 'Lagos',
      city: 'ikeja',
      latitude: 6.6,
      longitude: 3.3,
    });

    page['onAddressTyped']('dropoff', '12 Aminu Kano Crescent, Wing B');
    expect(page['draft']().dropoff.latitude).toBeUndefined();
    expect(page['draft']().dropoff.longitude).toBeUndefined();
    expect(page['draft']().dropoff.state).toBe('Lagos');
  });

  it('keeps the street but leaves the state alone when Google names one we do not list', async () => {
    await render();
    const page = fixture.componentInstance;
    await page['onPlace']('pickup', {
      placeId: 'p2',
      street: '1 Hill Road',
      state: 'Kano',
      cityCandidates: [],
      latitude: null,
      longitude: null,
    });
    expect(page['draft']().pickup).toMatchObject({ address: '1 Hill Road', state: '' });
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
