import { NgTemplateOutlet, isPlatformBrowser, Location } from '@angular/common';
import { Component, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarAltArrowLeftBoldDuotone,
  solarBoxBoldDuotone,
  solarCameraBoldDuotone,
  solarCloseCircleBoldDuotone,
  solarDeliveryBoldDuotone,
  solarLockKeyholeBoldDuotone,
  solarStarBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { AuthService } from '@core/auth/auth.service';
import { HapticsService } from '@core/services/haptics.service';
import { ToastService } from '@core/services/toast.service';
import { SavedAddressesService } from '@core/services/saved-addresses.service';
import { SITE_NAME, SeoService } from '@core/services/seo.service';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { SendDeliveryService } from '../../send-delivery.service';
import {
  CourierRate,
  DeliveryType,
  LocationIds,
  MAX_PARCEL_IMAGES,
  Option,
  ParcelImage,
  ParcelType,
  SendDraft,
  emptyDraft,
} from '../../send-delivery.model';

const DRAFT_KEY = 'fardelins.send-draft';
const STEPS = [
  { id: 1, label: 'Parcel', title: 'What are you sending?' },
  { id: 2, label: 'Route', title: 'Where is it going?' },
  { id: 3, label: 'Courier', title: 'Choose a courier' },
] as const;
const COURIER_STEP = 3;
/** The courier list gets a search box only once it is long enough to need one. */
const SEARCH_AFTER = 6;

type Party = 'pickup' | 'dropoff';

@Component({
  selector: 'app-send-delivery',
  imports: [NgIcon, NgTemplateOutlet, Skeleton],
  viewProviders: [
    provideIcons({
      solarAltArrowLeftBoldDuotone,
      solarBoxBoldDuotone,
      solarCameraBoldDuotone,
      solarCloseCircleBoldDuotone,
      solarDeliveryBoldDuotone,
      solarLockKeyholeBoldDuotone,
      solarStarBoldDuotone,
    }),
  ],
  templateUrl: './send-delivery.html',
  styleUrls: ['../../../../shared/styles/forms.css', './send-delivery.css'],
})
export class SendDelivery {
  private readonly api = inject(SendDeliveryService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly haptics = inject(HapticsService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly addressBook = inject(SavedAddressesService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly steps = STEPS;
  protected readonly draft = signal<SendDraft>(emptyDraft());
  protected readonly currentStep = signal(1);
  /** Steps whose Continue was pressed while incomplete: only these show "required" messages. */
  protected readonly attempted = signal<ReadonlySet<number>>(new Set());
  protected readonly categories = signal<Option[]>([]);
  protected readonly sizes = signal<Option[]>([]);
  protected readonly loadingCategories = signal(true);
  protected readonly loadingSizes = signal(true);
  protected readonly categoriesError = signal<string | null>(null);
  protected readonly sizesError = signal<string | null>(null);
  /** Shared across pickup/dropoff, both parties are within the same (currently fixed) country. */
  protected readonly states = signal<Option[]>([]);
  protected readonly loadingStates = signal(true);
  protected readonly statesError = signal<string | null>(null);
  protected readonly pickupCities = signal<Option[]>([]);
  protected readonly dropoffCities = signal<Option[]>([]);
  protected readonly loadingPickupCities = signal(false);
  protected readonly loadingDropoffCities = signal(false);
  protected readonly rates = signal<CourierRate[]>([]);
  protected readonly loadingRates = signal(false);
  protected readonly ratesError = signal<string | null>(null);
  protected readonly uploading = signal(false);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly courierQuery = signal('');
  protected readonly maxImages = MAX_PARCEL_IMAGES;
  protected readonly parcelTypes: { value: ParcelType; label: string }[] = [
    { value: 'non_perishable', label: 'Non-perishable' },
    { value: 'perishable', label: 'Perishable' },
  ];
  protected readonly savedAddresses = this.addressBook.items;
  protected readonly step = computed(() => STEPS[this.currentStep() - 1]);

  protected readonly parcelDone = computed(() => {
    const { sizeId, type, shortDescription, weight, images } = this.draft().parcel;
    // BE is making at least one photo compulsory.
    return Boolean(sizeId && type && shortDescription.trim() && weight && images.length > 0);
  });
  protected readonly pickupDone = computed(() => {
    const draft = this.draft();
    const { fullName, phone, email, address, state, city } = draft.pickup;
    // sender_details carries the pickup address and requires a city id; a state with no cities can't supply one.
    const cityPicked = !this.pickupCities().length || Boolean(city.trim());
    const located = Boolean(address.trim() && state.trim() && cityPicked);
    if (draft.fromMe) return located;
    return located && Boolean(fullName.trim() && phone.trim() && email.trim());
  });
  protected readonly dropoffDone = computed(() => {
    const { fullName, phone, email, address, state, city } = this.draft().dropoff;
    // BE requires receiver_email (no username lookup yet) and a city id when the state has cities.
    const cityPicked = !this.dropoffCities().length || Boolean(city.trim());
    return Boolean(
      fullName.trim() &&
      phone.trim() &&
      email.trim() &&
      address.trim() &&
      state.trim() &&
      cityPicked,
    );
  });
  protected readonly routeDone = computed(() => this.pickupDone() && this.dropoffDone());
  protected readonly canPay = computed(() => Boolean(this.selectedRate()));

  /** How far ahead the progress bar lets the user jump. */
  protected readonly maxReachableStep = computed(() => {
    if (!this.parcelDone()) return 1;
    if (!this.routeDone()) return 2;
    return COURIER_STEP;
  });

  protected readonly selectedSize = computed(
    () => this.sizes().find((size) => size.id === this.draft().parcel.sizeId) ?? null,
  );
  protected readonly selectedRate = computed(
    () => this.rates().find((rate) => rate.rateId === this.draft().rateId) ?? null,
  );
  protected readonly visibleRates = computed(() => {
    const term = this.courierQuery().trim().toLowerCase();
    return term
      ? this.rates().filter((rate) => rate.courierName.toLowerCase().includes(term))
      : this.rates();
  });
  protected readonly showCourierSearch = computed(() => this.rates().length > SEARCH_AFTER);
  /** Tags only mean something when there is more than one courier to compare. */
  protected readonly cheapestId = computed(() => {
    const rates = this.rates();
    if (rates.length < 2) return null;
    const lowest = Math.min(...rates.map((rate) => rate.amount));
    const winners = rates.filter((rate) => rate.amount === lowest);
    return winners.length === 1 ? winners[0].rateId : null;
  });
  protected readonly fastestId = computed(() => {
    const timed = this.rates()
      .map((rate) => ({ rate, days: leadingNumber(rate.deliveryWindow) }))
      .filter((entry): entry is { rate: CourierRate; days: number } => entry.days !== null);
    if (timed.length < 2) return null;
    const best = timed.reduce((a, b) => (b.days < a.days ? b : a));
    return timed.filter((entry) => entry.days === best.days).length === 1 ? best.rate.rateId : null;
  });

  protected readonly parcelLine = computed(() => {
    const { shortDescription, weight, quantity } = this.draft().parcel;
    return [
      shortDescription.trim(),
      this.selectedSize()?.label,
      weight ? `${weight} kg${quantity > 1 ? ` × ${quantity}` : ''}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  });
  protected readonly dropoffLine = computed(() =>
    [this.draft().dropoff.address.trim(), this.place('dropoff')].filter(Boolean).join(', '),
  );
  protected readonly deliveryLine = computed(() => {
    const { deliveryType, priority } = this.draft();
    return `${deliveryType === 'office' ? 'Courier office' : 'Doorstep'} · ${priority ? 'Priority' : 'Standard'}`;
  });

  constructor() {
    this.seo.update({
      title: `Create a delivery | ${SITE_NAME}`,
      description: 'Send a package with Fardelins.',
      path: '/app/send',
      robots: 'noindex, nofollow',
    });

    this.restoreDraft();
    this.prefillSender();
    const user = this.auth.user();
    if (user) this.addressBook.load(user.id);
    void this.loadOptions();

    // A long form on mobile: persist every change so a refresh or backgrounded tab can't lose it.
    effect(() => {
      const draft = this.draft();
      if (this.isBrowser) this.persist(draft);
    });
  }

  /** Step 1 leaves the flow; later steps go back one. */
  protected back(): void {
    this.haptics.light();
    if (this.currentStep() === 1) {
      this.location.back();
      return;
    }
    this.show(this.currentStep() - 1);
  }

  protected stepDone(id: number): boolean {
    if (id === 1) return this.parcelDone();
    if (id === 2) return this.routeDone();
    return this.canPay();
  }

  protected goToStep(id: number): void {
    if (id > this.maxReachableStep() || id === this.currentStep()) return;
    this.haptics.selection();
    this.show(id);
  }

  /** Continue never disables: an incomplete step says what is missing instead. */
  protected continue(): void {
    const id = this.currentStep();
    if (this.stepDone(id)) {
      this.haptics.light();
      this.show(id + 1);
      return;
    }
    this.attempted.update((set) => new Set(set).add(id));
    this.haptics.error();
    queueMicrotask(() =>
      document
        .querySelector('.send .is-missing')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    );
  }

  protected showErrors(id: number): boolean {
    return this.attempted().has(id);
  }

  private show(step: number): void {
    this.currentStep.set(step);
    if (this.isBrowser) globalThis.scrollTo?.({ top: 0 });
    if (step === COURIER_STEP) void this.loadRates();
  }

  protected selectDeliveryType(deliveryType: DeliveryType): void {
    if (this.draft().deliveryType === deliveryType) return;
    this.haptics.selection();
    this.draft.update((draft) => ({ ...draft, deliveryType, rateId: null }));
    void this.loadRates();
  }

  protected selectSpeed(priority: boolean): void {
    if (this.draft().priority === priority) return;
    this.haptics.selection();
    this.draft.update((draft) => ({ ...draft, priority, rateId: null }));
    void this.loadRates();
  }

  protected patchParcel(patch: Partial<SendDraft['parcel']>): void {
    this.draft.update((draft) => ({ ...draft, parcel: { ...draft.parcel, ...patch } }));
  }

  protected selectSize(id: number): void {
    this.haptics.selection();
    this.patchParcel({ sizeId: id });
  }

  protected selectCategory(id: number): void {
    this.haptics.selection();
    this.patchParcel({ categoryId: this.draft().parcel.categoryId === id ? null : id });
  }

  protected selectParcelType(type: ParcelType): void {
    this.haptics.selection();
    this.patchParcel({ type });
  }

  protected stepQuantity(delta: number): void {
    const quantity = Math.max(1, this.draft().parcel.quantity + delta);
    this.haptics.selection();
    this.patchParcel({ quantity });
  }

  protected patchParty(which: Party, patch: Partial<SendDraft['pickup']>): void {
    this.draft.update((draft) => ({ ...draft, [which]: { ...draft[which], ...patch } }));
  }

  protected useSavedAddress(which: Party, addressId: string): void {
    const address = this.savedAddresses().find((item) => item.id === addressId);
    if (!address) return;
    this.haptics.selection();
    this.patchParty(which, { address: address.address, state: address.state, city: address.city });
    void this.loadCities(which, address.state);
  }

  protected isSavedAddressUsed(which: Party, addressId: string): boolean {
    const address = this.savedAddresses().find((item) => item.id === addressId);
    const party = this.draft()[which];
    return Boolean(address && address.address === party.address && address.state === party.state);
  }

  protected setFromMe(fromMe: boolean): void {
    this.haptics.selection();
    this.draft.update((draft) => ({ ...draft, fromMe }));
    if (fromMe) this.prefillSender();
  }

  protected selectRate(rate: CourierRate): void {
    this.haptics.selection();
    this.draft.update((draft) => ({ ...draft, rateId: rate.rateId }));
  }

  /** Size cards grow left to right so the pick literally looks bigger, independent of API labels. */
  protected sizeIconSize(index: number): number {
    const total = this.sizes().length;
    if (total <= 1) return 26;
    return 20 + (14 * index) / (total - 1);
  }

  protected party(which: Party): SendDraft['pickup'] {
    return this.draft()[which];
  }

  protected citiesFor(which: Party): Option[] {
    return which === 'pickup' ? this.pickupCities() : this.dropoffCities();
  }

  protected citiesLoading(which: Party): boolean {
    return which === 'pickup' ? this.loadingPickupCities() : this.loadingDropoffCities();
  }

  protected place(which: Party): string {
    const { city, state } = this.draft()[which];
    return [city, state].filter(Boolean).join(', ');
  }

  protected async onFiles(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const room = MAX_PARCEL_IMAGES - this.draft().parcel.images.length;
    if (room <= 0) {
      this.uploadError.set(`You can attach up to ${MAX_PARCEL_IMAGES} photos.`);
      input.value = '';
      return;
    }
    const files = Array.from(input.files).slice(0, room);
    this.uploading.set(true);
    this.uploadError.set(null);
    try {
      const images = await this.api.uploadImages(files);
      this.patchParcel({ images: [...this.draft().parcel.images, ...images] });
      if (input.files.length > files.length) {
        this.uploadError.set(
          `Only added ${files.length}; the limit is ${MAX_PARCEL_IMAGES} photos.`,
        );
      }
    } catch (error) {
      this.uploadError.set((error as Error).message);
      this.haptics.error();
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  protected removeImage(id: string): void {
    this.patchParcel({ images: this.draft().parcel.images.filter((image) => image.id !== id) });
  }

  protected async loadRates(): Promise<void> {
    if (!this.parcelDone() || !this.dropoffDone()) return;
    this.loadingRates.set(true);
    this.ratesError.set(null);
    try {
      const rates = await this.api.rates(this.draft());
      this.rates.set(rates);
      if (!rates.length) {
        const { deliveryType, priority } = this.draft();
        this.ratesError.set(
          deliveryType !== 'user' || priority
            ? 'No courier offers these options on this route. Try Doorstep and Standard.'
            : 'No courier covers this route yet.',
        );
      }
    } catch {
      this.ratesError.set("We couldn't load couriers for this route.");
    } finally {
      this.loadingRates.set(false);
    }
  }

  protected async submit(): Promise<void> {
    if (!this.canPay()) {
      this.continue();
      return;
    }
    if (this.submitting()) return;
    this.submitting.set(true);
    this.haptics.light();
    try {
      const result = await this.api.order(this.draft(), {
        pickup: this.locationIds('pickup'),
        dropoff: this.locationIds('dropoff'),
      });
      this.haptics.success();
      this.clearDraft();
      if (result.authorizationUrl) {
        // Off-site Paystack page, so a full navigation, not a router one.
        globalThis.location.href = result.authorizationUrl;
        return;
      }
      await this.router.navigate(['/app/send', result.reference || 'new', 'success']);
    } catch (error) {
      this.toast.error("Couldn't place your order", {
        description: (error as Error).message,
        actions: [{ label: 'Try again', run: () => void this.submit() }],
      });
      this.haptics.error();
    } finally {
      this.submitting.set(false);
    }
  }

  private locationIds(which: Party): LocationIds {
    const party = this.draft()[which];
    const cities = which === 'pickup' ? this.pickupCities() : this.dropoffCities();
    return {
      stateId: this.states().find((option) => option.label === party.state)?.id ?? null,
      cityId: cities.find((option) => option.label === party.city)?.id ?? null,
    };
  }

  private prefillSender(): void {
    const user = this.auth.user();
    if (!user) return;
    this.draft.update((draft) => ({
      ...draft,
      pickup: {
        ...draft.pickup,
        fullName: draft.pickup.fullName || `${user.firstName} ${user.lastName}`.trim(),
        email: draft.pickup.email || user.email,
        phone: draft.pickup.phone || (user.phone ?? ''),
      },
    }));
  }

  protected async loadCategories(): Promise<void> {
    this.loadingCategories.set(true);
    this.categoriesError.set(null);
    try {
      this.categories.set(await this.api.categories());
    } catch {
      this.categoriesError.set("We couldn't load categories.");
    } finally {
      this.loadingCategories.set(false);
    }
  }

  protected async loadSizes(): Promise<void> {
    this.loadingSizes.set(true);
    this.sizesError.set(null);
    try {
      this.sizes.set(await this.api.sizes());
    } catch {
      this.sizesError.set("We couldn't load package sizes.");
    } finally {
      this.loadingSizes.set(false);
    }
  }

  protected async loadStates(): Promise<void> {
    this.loadingStates.set(true);
    this.statesError.set(null);
    try {
      this.states.set(await this.api.states());
    } catch {
      this.statesError.set("We couldn't load states.");
    } finally {
      this.loadingStates.set(false);
    }
  }

  /** A new state makes the picked city stale: clear it and load that state's cities. */
  protected onStateChange(which: Party, stateLabel: string): void {
    this.patchParty(which, { state: stateLabel, city: '' });
    void this.loadCities(which, stateLabel);
  }

  private async loadCities(which: Party, stateLabel: string): Promise<void> {
    const cities = which === 'pickup' ? this.pickupCities : this.dropoffCities;
    const loading = which === 'pickup' ? this.loadingPickupCities : this.loadingDropoffCities;
    const state = this.states().find((option) => option.label === stateLabel);
    if (!state) {
      cities.set([]);
      return;
    }
    loading.set(true);
    try {
      cities.set(await this.api.cities(state.id));
    } catch {
      cities.set([]);
    } finally {
      loading.set(false);
    }
  }

  private async loadOptions(): Promise<void> {
    await Promise.allSettled([this.loadCategories(), this.loadSizes(), this.loadStates()]);
    // Resuming a saved draft: reload each party's cities without touching its already-picked city.
    const { pickup, dropoff } = this.draft();
    if (pickup.state) void this.loadCities('pickup', pickup.state);
    if (dropoff.state) void this.loadCities('dropoff', dropoff.state);
  }

  private restoreDraft(): void {
    if (!this.isBrowser) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as SendDraft;
      // Drafts saved before images carried their upload id held bare links, which an order can't send.
      const images = (saved.parcel?.images ?? []).filter(
        (image): image is ParcelImage => typeof image === 'object' && Boolean(image?.id),
      );
      const empty = emptyDraft();
      this.draft.set({ ...empty, ...saved, parcel: { ...empty.parcel, ...saved.parcel, images } });
    } catch {
      this.clearDraft();
    }
  }

  private persist(draft: SendDraft): void {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Quota or private mode, the form still works for this session.
    }
  }

  private clearDraft(): void {
    if (this.isBrowser) localStorage.removeItem(DRAFT_KEY);
  }
}

function leadingNumber(value: string | null): number | null {
  const match = value?.match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}
