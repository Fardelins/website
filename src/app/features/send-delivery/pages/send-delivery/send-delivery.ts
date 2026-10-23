import { Location, NgTemplateOutlet, TitleCasePipe, isPlatformBrowser } from '@angular/common';
import {
  Component,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
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
import { PlaceDetails } from '@core/services/google-places.service';
import { HapticsService } from '@core/services/haptics.service';
import { matchCity, matchState } from '@core/services/place-match';
import { ToastService } from '@core/services/toast.service';
import { SavedAddressesService, type SavedAddress } from '@core/services/saved-addresses.service';
import { StorefrontService } from '@features/storefront/storefront.service';
import { Storefront } from '@features/storefront/storefront.models';
import { SITE_NAME, SeoService } from '@core/services/seo.service';
import { AddressSearch } from '@shared/components/address-search/address-search';
import { MapPicker } from '@shared/components/map-picker/map-picker';
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
  {
    id: 1,
    label: 'Parcel Info',
    title: 'What are you sending?',
    subtitle: 'Add your parcel details, size and photos.',
  },
  {
    id: 2,
    label: 'Set Route',
    title: 'Where is it going?',
    subtitle: 'Set the pickup and recipient addresses.',
  },
  {
    id: 3,
    label: 'Select Courier',
    title: 'Choose a courier',
    subtitle: 'Compare delivery options and choose your courier.',
  },
] as const;
const COURIER_STEP = 3;
const COURIERS_PER_PAGE = 6;

type Party = 'pickup' | 'dropoff';
type AddressSelection = { kind: 'saved'; id: string } | { kind: 'property'; id: string };

@Component({
  selector: 'app-send-delivery',
  imports: [NgIcon, NgTemplateOutlet, TitleCasePipe, Skeleton, AddressSearch, MapPicker],
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
  styleUrls: [
    '../../../../shared/styles/forms.css',
    './send-delivery.css',
    './send-delivery-summary.css',
  ],
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
  private readonly storefrontApi = inject(StorefrontService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private ratesRequest = 0;

  private readonly stepsDialog = viewChild<ElementRef<HTMLDialogElement>>('stepsDialog');
  private readonly summaryDialog = viewChild<ElementRef<HTMLDialogElement>>('summaryDialog');
  protected readonly stepsOpen = signal(false);
  protected readonly steps = STEPS;
  protected readonly draft = signal<SendDraft>(emptyDraft());
  protected readonly currentStep = signal(1);
  /** Steps whose Continue was pressed while incomplete: only these show "required" messages. */
  protected readonly attempted = signal<ReadonlySet<number>>(new Set());
  protected readonly sizes = signal<Option[]>([]);
  protected readonly loadingSizes = signal(true);
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
  private readonly courierLimit = signal(COURIERS_PER_PAGE);
  protected readonly maxImages = MAX_PARCEL_IMAGES;
  protected readonly properties = signal<Storefront[]>([]);
  protected readonly propertiesWithAddresses = computed(() =>
    this.properties().filter((property) => Boolean(property.location?.address)),
  );
  protected readonly loadingProperties = signal(false);
  protected readonly weightUnit = signal<'kg' | 'lb' | 'g' | 'oz'>('kg');
  protected readonly weightInputValue = signal<string | null>(null);
  protected readonly customWeightEnabled = computed(() => Boolean(this.draft().parcel.customWeight));
  protected readonly parcelTypes: { value: ParcelType; label: string }[] = [
    { value: 'non_perishable', label: 'Non-perishable' },
    { value: 'perishable', label: 'Perishable' },
  ];
  protected readonly savedAddresses = this.addressBook.items;
  protected readonly savedAddressOpen = signal<Party | null>(null);
  private readonly mapPicker = viewChild(MapPicker);
  protected readonly mapTarget = signal<Party>('pickup');
  protected readonly addressSelections = signal<Record<Party, AddressSelection | null>>({
    pickup: null,
    dropoff: null,
  });
  protected readonly manualAddressOpen = signal<Record<Party, boolean>>({
    pickup: false,
    dropoff: false,
  });
  protected readonly addressSearchRequest = signal<Record<Party, number>>({
    pickup: 0,
    dropoff: 0,
  });
  protected readonly step = computed(() => STEPS[this.currentStep() - 1]);

  protected readonly parcelDone = computed(() => {
    const { sizeId, type, shortDescription, weight, customWeight, images } = this.draft().parcel;
    // BE is making at least one photo compulsory.
    return Boolean(
      sizeId &&
        type &&
        shortDescription.trim() &&
        images.length > 0 &&
        (!customWeight || weight),
    );
  });
  protected readonly pickupDone = computed(() => {
    const draft = this.draft();
    const { fullName, phone, email, address, state, city } = draft.pickup;
    // sender_details carries the pickup address and requires a city id; a state with no cities can't supply one.
    const cityPicked = !this.pickupCities().length || Boolean(city.trim());
    const located = Boolean(address.trim() && state.trim() && cityPicked);
    if (draft.fromMe) return located;
    return located && Boolean(this.hasFullName(fullName) && phone.trim() && email.trim());
  });
  protected readonly dropoffDone = computed(() => {
    const { fullName, phone, email, address, state, city } = this.draft().dropoff;
    // BE requires receiver_email (no username lookup yet) and a city id when the state has cities.
    const cityPicked = !this.dropoffCities().length || Boolean(city.trim());
    return Boolean(
      this.hasFullName(fullName) &&
      phone.trim() &&
      email.trim() &&
      address.trim() &&
      state.trim() &&
      cityPicked,
    );
  });
  protected readonly routeDone = computed(() => this.pickupDone() && this.dropoffDone());
  protected readonly canPay = computed(() => Boolean(this.selectedRate()));

  protected hasFullName(value: string): boolean {
    return value.trim().split(/\s+/).filter(Boolean).length >= 2;
  }

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
  protected readonly matchingRates = computed(() => {
    const term = this.courierQuery().trim().toLowerCase();
    return term
      ? this.rates().filter((rate) => rate.courierName.toLowerCase().includes(term))
      : this.rates();
  });
  protected readonly visibleRates = computed(() =>
    this.matchingRates().slice(0, this.courierLimit()),
  );
  protected readonly showCourierSearch = computed(() => this.rates().length > 1);
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

  protected readonly parcelSizeLine = computed(() => this.selectedSize()?.label ?? null);
  protected readonly parcelTypeLine = computed(() => {
    const type = this.draft().parcel.type;
    return type === 'perishable' ? 'Perishable' : type === 'non_perishable' ? 'Non-perishable' : null;
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
    if (user) {
      this.addressBook.load(user.id);
      void this.loadProperties();
    }
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

  protected openSteps(): void {
    this.haptics.light();
    this.stepsDialog()?.nativeElement.showModal();
    this.stepsOpen.set(true);
  }

  protected closeSteps(): void {
    this.stepsDialog()?.nativeElement.close();
    this.stepsOpen.set(false);
  }

  protected openSummary(): void {
    this.haptics.light();
    this.summaryDialog()?.nativeElement.showModal();
  }

  protected closeSummary(): void {
    this.summaryDialog()?.nativeElement.close();
  }

  protected onSummaryBackdrop(event: MouseEvent): void {
    const dialog = this.summaryDialog()?.nativeElement;
    if (!dialog || event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      this.closeSummary();
  }

  protected selectSheetStep(id: number): void {
    if (id > this.maxReachableStep()) return;
    this.goToStep(id);
    this.closeSteps();
  }

  protected onStepsBackdrop(event: MouseEvent): void {
    const dialog = this.stepsDialog()?.nativeElement;
    if (!dialog || event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      this.closeSteps();
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
    if (this.isBrowser) {
      const shellScroller = document.querySelector<HTMLElement>('.shell__body');
      if (shellScroller) shellScroller.scrollTo({ top: 0 });
      else globalThis.scrollTo?.({ top: 0 });
    }
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

  protected displayWeight(): number | null {
    const kilograms = this.draft().parcel.weight;
    if (kilograms === null) return null;
    const factors = { kg: 1, lb: 2.2046226218, g: 1000, oz: 35.27396195 };
    const value = kilograms * factors[this.weightUnit()];
    return Number(value.toFixed(this.weightUnit() === 'g' ? 0 : 2));
  }

  protected displayWeightInput(): string {
    const weight = this.displayWeight();
    return weight === null
      ? ''
      : new Intl.NumberFormat('en-US', {
          maximumFractionDigits: this.weightUnit() === 'g' ? 0 : 2,
        }).format(weight);
  }

  protected updateWeightInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cursor = input.selectionStart ?? input.value.length;
    const ungroupedBeforeCursor = input.value.slice(0, cursor).replace(/,/g, '');
    const raw = input.value.replace(/,/g, '').replace(/[^\d.]/g, '');
    const [integer = '', ...fractionParts] = raw.split('.');
    const maxFractionDigits = this.weightUnit() === 'g' ? 0 : 2;
    const fraction = fractionParts.join('').slice(0, maxFractionDigits);
    const normalized = fractionParts.length && maxFractionDigits > 0 ? `${integer}.${fraction}` : integer;
    const formatted = groupThousands(normalized);
    const parsed = Number(normalized);
    const factors = { kg: 1, lb: 2.2046226218, g: 1000, oz: 35.27396195 };
    const kilograms =
      normalized && Number.isFinite(parsed) && parsed > 0
        ? parsed / factors[this.weightUnit()]
        : null;
    this.patchParcel({ weight: kilograms });
    this.weightInputValue.set(formatted);

    input.value = formatted;
    const meaningfulCharacters = ungroupedBeforeCursor.replace(/[^\d.]/g, '').length;
    let nextCursor = 0;
    let countedCharacters = 0;
    while (nextCursor < formatted.length && countedCharacters < meaningfulCharacters) {
      if (formatted[nextCursor] !== ',') countedCharacters++;
      nextCursor++;
    }
    requestAnimationFrame(() => input.setSelectionRange(nextCursor, nextCursor));
  }

  protected commitWeightInput(): void {
    this.weightInputValue.set(null);
  }

  protected changeWeightUnit(unit: 'kg' | 'lb' | 'g' | 'oz'): void {
    this.weightUnit.set(unit);
    this.weightInputValue.set(null);
  }

  protected toggleCustomWeight(): void {
    const enabled = !this.customWeightEnabled();
    this.patchParcel({ customWeight: enabled, ...(enabled ? {} : { weight: null }) });
    this.weightInputValue.set(null);
  }

  protected displayWorth(): string {
    const worth = this.draft().parcel.worth;
    return worth === null
      ? ''
      : new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(worth);
  }

  protected updateWorth(value: string): void {
    const digits = value.replace(/\D/g, '');
    this.patchParcel({ worth: digits ? Number(digits) : null });
  }

  protected patchParcel(patch: Partial<SendDraft['parcel']>): void {
    this.draft.update((draft) => ({ ...draft, parcel: { ...draft.parcel, ...patch } }));
  }

  protected selectSize(id: number): void {
    this.haptics.selection();
    this.patchParcel({ sizeId: id, customWeight: false, weight: null });
    this.weightInputValue.set(null);
  }

  protected selectParcelType(type: ParcelType): void {
    this.haptics.selection();
    this.patchParcel({ type });
  }

  protected patchParty(which: Party, patch: Partial<SendDraft['pickup']>): void {
    this.draft.update((draft) => ({ ...draft, [which]: { ...draft[which], ...patch } }));
  }

  protected async useSavedAddress(which: Party, addressId: string): Promise<void> {
    if (this.isSavedAddressUsedByOther(which, addressId)) return;
    const address = this.savedAddresses().find((item) => item.id === addressId);
    if (!address) return;
    this.addressSelections.update((selection) => ({
      ...selection,
      [which]: { kind: 'saved', id: addressId },
    }));
    this.haptics.selection();
    if (!this.states().length) await this.loadStates();
    const state = matchState(this.states(), address.state)?.label ?? address.state;
    this.patchParty(which, {
      address: this.savedAddressText(address),
      state,
      city: '',
      latitude: undefined,
      longitude: undefined,
    });
    this.savedAddressOpen.set(null);
    this.manualAddressOpen.update((open) => ({ ...open, [which]: false }));
    this.addressSearchRequest.update((requests) => ({
      ...requests,
      [which]: requests[which] + 1,
    }));
    await this.loadCities(which, state);
    const city = matchCity(this.citiesFor(which), [address.city]);
    if (city) this.patchParty(which, { city: city.label });
  }

  private savedAddressText(address: SavedAddress): string {
    return this.completeAddressText(address.address, address.city, address.state);
  }

  private completeAddressText(address: string, city: string, state: string): string {
    const parts = address
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const hasPart = (value: string) => {
      const normalized = value.trim().toLocaleLowerCase();
      return parts.some((part) => {
        const existing = part.toLocaleLowerCase();
        return existing === normalized || existing.startsWith(`${normalized} `);
      });
    };
    for (const part of [city, state, 'Nigeria']) {
      if (part && !hasPart(part)) parts.push(part.trim());
    }
    return parts.join(', ');
  }

  protected canUseSavedAddress(): boolean {
    return true;
  }

  protected toggleSavedAddress(which: Party): void {
    this.savedAddressOpen.update((open) => (open === which ? null : which));
  }

  protected toggleManualAddress(which: Party): void {
    const opening = !this.manualAddressOpen()[which];
    this.manualAddressOpen.update((open) => ({ ...open, [which]: opening }));
    if (opening) {
      this.savedAddressOpen.set(null);
      this.clearAddressSelection(which);
    }
  }

  protected isManualAddressOpen(which: Party): boolean {
    return this.manualAddressOpen()[which];
  }

  protected propertyAddressLabel(property: Storefront): string {
    return property.name.trim() || property.location?.address.trim() || 'Property address';
  }

  protected async usePropertyAddress(which: Party, propertyId: string): Promise<void> {
    if (this.isPropertyAddressUsedByOther(which, propertyId)) return;
    const property = this.properties().find((item) => item.id === propertyId);
    const location = property?.location;
    if (!location) return;

    this.addressSelections.update((selection) => ({
      ...selection,
      [which]: { kind: 'property', id: propertyId },
    }));
    this.haptics.selection();
    if (this.loadingStates() || !this.states().length) await this.loadStates();
    const state = this.states().find((option) => option.id === location.stateId);
    this.patchParty(which, {
      address: location.address,
      state: state?.label ?? '',
      city: '',
      latitude: location.latitude ?? undefined,
      longitude: location.longitude ?? undefined,
    });
    this.savedAddressOpen.set(null);
    this.manualAddressOpen.update((open) => ({ ...open, [which]: false }));
    if (state) await this.applyPropertyCity(which, location.cityId, state.label);
    const party = this.draft()[which];
    this.patchParty(which, {
      address: this.completeAddressText(party.address, party.city, party.state),
    });
    this.addressSearchRequest.update((requests) => ({ ...requests, [which]: requests[which] + 1 }));
  }

  protected isPropertyAddressUsed(which: Party, propertyId: string): boolean {
    const selection = this.addressSelections()[which];
    if (selection) return selection.kind === 'property' && selection.id === propertyId;
    const location = this.properties().find((item) => item.id === propertyId)?.location;
    const party = this.draft()[which];
    const stateId = this.states().find((item) => item.label === party.state)?.id;
    const baseAddress = this.normalizeAddress(location?.address ?? '');
    const currentAddress = this.normalizeAddress(party.address);
    return Boolean(
      location && baseAddress && location.stateId === stateId &&
        (currentAddress === baseAddress || currentAddress.startsWith(`${baseAddress},`)),
    );
  }

  protected isPropertyAddressUsedByOther(which: Party, propertyId: string): boolean {
    return this.isPropertyAddressUsed(which === 'pickup' ? 'dropoff' : 'pickup', propertyId);
  }

  protected isSavedAddressUsed(which: Party, addressId: string): boolean {
    const selection = this.addressSelections()[which];
    if (selection) return selection.kind === 'saved' && selection.id === addressId;
    const address = this.savedAddresses().find((item) => item.id === addressId);
    const party = this.draft()[which];
    const savedState = matchState(this.states(), address?.state ?? '')?.label ?? address?.state ?? '';
    return Boolean(
      address &&
        this.savedAddressText(address).toLocaleLowerCase() === party.address.trim().toLocaleLowerCase() &&
        savedState.toLocaleLowerCase() === party.state.toLocaleLowerCase(),
    );
  }

  protected isSavedAddressUsedByOther(which: Party, addressId: string): boolean {
    return this.isSavedAddressUsed(which === 'pickup' ? 'dropoff' : 'pickup', addressId);
  }

  private normalizeAddress(address: string): string {
    return address.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  }

  private clearAddressSelection(which: Party): void {
    this.addressSelections.update((selection) => ({ ...selection, [which]: null }));
  }

  protected setFromMe(fromMe: boolean): void {
    this.haptics.selection();
    this.draft.update((draft) => ({ ...draft, fromMe }));
    if (fromMe) this.prefillSender();
  }

  protected searchCouriers(query: string): void {
    this.courierQuery.set(query);
    this.courierLimit.set(COURIERS_PER_PAGE);
  }

  protected loadMoreCouriers(): void {
    this.courierLimit.update((limit) => limit + COURIERS_PER_PAGE);
  }

  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join('');
  }

  protected selectRate(rate: CourierRate): void {
    this.haptics.selection();
    this.draft.update((draft) => ({ ...draft, rateId: rate.rateId }));
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
    const request = ++this.ratesRequest;
    this.loadingRates.set(true);
    this.ratesError.set(null);
    try {
      const rates = await this.api.rates(this.draft());
      if (request !== this.ratesRequest) return;
      this.rates.set(rates);
      this.courierLimit.set(COURIERS_PER_PAGE);
      if (!rates.length) {
        const { deliveryType, priority } = this.draft();
        this.ratesError.set(
          deliveryType !== 'user' || priority
            ? 'No courier offers these options on this route. Try Doorstep and Standard.'
            : 'No courier covers this route yet.',
        );
      }
    } catch {
      if (request === this.ratesRequest) {
        this.ratesError.set("We couldn't load couriers for this route.");
      }
    } finally {
      if (request === this.ratesRequest) this.loadingRates.set(false);
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

  /** Hand-typing an address drops any Google coordinates, they no longer describe the text. */
  protected onAddressTyped(which: Party, address: string): void {
    this.clearAddressSelection(which);
    this.patchParty(which, { address, latitude: undefined, longitude: undefined });
  }

  protected openMapPicker(which: Party): void {
    this.mapTarget.set(which);
    const { latitude, longitude, address, city, state } = this.draft()[which];
    void this.mapPicker()?.open({
      lat: latitude,
      lon: longitude,
      query: [address, city, state].filter((part) => part.trim()).join(', '),
    });
  }

  protected onMapPicked(place: PlaceDetails): void {
    void this.onPlace(this.mapTarget(), place);
  }

  /** Keep Google's complete address in the input and match its region/locality to our own lists. */
  protected async onPlace(which: Party, place: PlaceDetails): Promise<void> {
    this.clearAddressSelection(which);
    const state = matchState(this.states(), place.state);
    this.patchParty(which, {
      address: place.formattedAddress || place.street,
      latitude: place.latitude ?? undefined,
      longitude: place.longitude ?? undefined,
      state: state?.label ?? '',
      city: '',
    });
    if (!state) return;
    await this.loadCities(which, state.label);
    const cities = which === 'pickup' ? this.pickupCities() : this.dropoffCities();
    const city = matchCity(cities, place.cityCandidates);
    if (city) this.patchParty(which, { city: city.label });
  }

  /** A new state makes the picked city stale: clear it and load that state's cities. */
  protected onStateChange(which: Party, stateLabel: string): void {
    this.clearAddressSelection(which);
    this.patchParty(which, {
      state: stateLabel,
      city: '',
      latitude: undefined,
      longitude: undefined,
    });
    void this.loadCities(which, stateLabel);
  }

  protected onCityChange(which: Party, city: string): void {
    this.clearAddressSelection(which);
    this.patchParty(which, { city, latitude: undefined, longitude: undefined });
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
    await Promise.allSettled([this.loadSizes(), this.loadStates()]);
    // Resuming a saved draft: reload each party's cities without touching its already-picked city.
    const { pickup, dropoff } = this.draft();
    if (pickup.state) void this.loadCities('pickup', pickup.state);
    if (dropoff.state) void this.loadCities('dropoff', dropoff.state);
  }

  private async loadProperties(): Promise<void> {
    this.loadingProperties.set(true);
    try {
      this.properties.set(await this.storefrontApi.list());
    } catch {
      this.properties.set([]);
    } finally {
      this.loadingProperties.set(false);
    }
  }

  private async applyPropertyCity(which: Party, cityId: number | null, stateLabel: string): Promise<void> {
    await this.loadCities(which, stateLabel);
    const city = this.citiesFor(which).find((option) => option.id === cityId);
    if (city) this.patchParty(which, { city: city.label });
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
      this.draft.set({
        ...empty,
        ...saved,
        parcel: {
          ...empty.parcel,
          ...saved.parcel,
          type: saved.parcel?.type ?? empty.parcel.type,
          customWeight: saved.parcel?.customWeight ?? Boolean(saved.parcel?.weight),
          images,
        },
      });
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

function groupThousands(value: string): string {
  const [integer, fraction] = value.split('.');
  const groupedInteger = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === undefined ? groupedInteger : `${groupedInteger}.${fraction}`;
}

function leadingNumber(value: string | null): number | null {
  const match = value?.match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : null;
}
