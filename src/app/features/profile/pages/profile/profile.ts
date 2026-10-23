import { TitleCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarCalendarBoldDuotone,
  solarCameraBoldDuotone,
  solarCard2BoldDuotone,
  solarCardBoldDuotone,
  solarCheckCircleBoldDuotone,
  solarClockCircleBoldDuotone,
  solarCloudUploadBoldDuotone,
  solarDangerCircleBoldDuotone,
  solarDocumentTextBoldDuotone,
  solarEyeBoldDuotone,
  solarEyeClosedBoldDuotone,
  solarInfoCircleBoldDuotone,
  solarLogout2BoldDuotone,
  solarMapPointWaveBoldDuotone,
  solarPassportBoldDuotone,
  solarPenBoldDuotone,
  solarShieldCheckBoldDuotone,
  solarTrashBinTrashBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { filter, map } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { DashboardPreferencesService } from '@core/services/dashboard-preferences.service';
import { PlaceDetails } from '@core/services/google-places.service';
import { matchCity, matchState, withoutCity } from '@core/services/place-match';
import { SavedAddress, SavedAddressesService } from '@core/services/saved-addresses.service';
import type { ThemePreference } from '@core/services/dashboard-preferences.service';
import { HapticsService } from '@core/services/haptics.service';
import { SITE_NAME, SeoService } from '@core/services/seo.service';
import { ToastService } from '@core/services/toast.service';
import { AvatarCropper } from '@shared/components/avatar-cropper/avatar-cropper';
import { AddressSearch } from '@shared/components/address-search/address-search';
import { Combobox, ComboboxOption } from '@shared/components/combobox/combobox';
import { EmptyState } from '@shared/components/empty-state/empty-state';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { AppPromoService } from '@features/app-promo/app-promo.service';
import { Option } from '@features/send-delivery/send-delivery.model';
import { SendDeliveryService } from '@features/send-delivery/send-delivery.service';
import { StorefrontSettings } from '@features/storefront/pages/storefront-settings/storefront-settings';
import {
  DocumentOcrService,
  DocumentScanResult,
  VerificationDocumentType,
} from '../../document-ocr.service';
import {
  documentNumberError,
  documentNumberRule,
  maskDocumentNumber,
  normalizeDocumentNumber,
} from '../../document-validation';
import { MyQr } from '../../components/my-qr/my-qr';
import { ProfileService, VerificationDoc } from '../../profile.service';

type SettingsTab =
  'profile' | 'addresses' | 'qr' | 'storefront' | 'appearance' | 'security' | 'verification';

const DOC_TYPES: VerificationDocumentType[] = [
  'NIN',
  'Passport',
  "Driver's Licence",
  "Voter's Card",
];
const DOC_TYPE_ICONS: Record<string, string> = {
  NIN: 'solarCardBoldDuotone',
  Passport: 'solarPassportBoldDuotone',
  "Driver's Licence": 'solarCard2BoldDuotone',
  "Voter's Card": 'solarDocumentTextBoldDuotone',
};
const ACCEPTED_DOCUMENT_TYPES = ['image/jpeg', 'application/pdf'];

/** Data saver or a 2G link: skip big downloads nobody asked for yet. */
function onSlowConnection(): boolean {
  if (typeof navigator === 'undefined') return true;
  const { connection } = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  return (
    Boolean(connection?.saveData) ||
    connection?.effectiveType === '2g' ||
    connection?.effectiveType === 'slow-2g'
  );
}
const MAX_DOCUMENT_SIZE = 3 * 1024 * 1024;
const OCR_SCAN_TIMEOUT_MS = 20_000;

@Component({
  selector: 'app-profile',
  imports: [
    RouterLink,
    NgIcon,
    AddressSearch,
    AvatarCropper,
    Combobox,
    EmptyState,
    MyQr,
    Skeleton,
    StorefrontSettings,
  ],
  viewProviders: [
    provideIcons({
      solarCalendarBoldDuotone,
      solarCameraBoldDuotone,
      solarCard2BoldDuotone,
      solarCardBoldDuotone,
      solarCheckCircleBoldDuotone,
      solarClockCircleBoldDuotone,
      solarCloudUploadBoldDuotone,
      solarDangerCircleBoldDuotone,
      solarDocumentTextBoldDuotone,
      solarEyeBoldDuotone,
      solarEyeClosedBoldDuotone,
      solarInfoCircleBoldDuotone,
      solarLogout2BoldDuotone,
      solarMapPointWaveBoldDuotone,
      solarPassportBoldDuotone,
      solarPenBoldDuotone,
      solarShieldCheckBoldDuotone,
      solarTrashBinTrashBoldDuotone,
    }),
  ],
  templateUrl: './profile.html',
  styleUrls: [
    '../../../../shared/styles/forms.css',
    './profile.css',
    './profile-appearance.css',
    './profile-verification.css',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile {
  private readonly titleCasePipe = new TitleCasePipe();
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly haptics = inject(HapticsService);
  private readonly toast = inject(ToastService);
  private readonly appPromo = inject(AppPromoService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly addressBook = inject(SavedAddressesService);
  private readonly deliveryApi = inject(SendDeliveryService);
  private readonly documentOcr = inject(DocumentOcrService);
  protected readonly preferences = inject(DashboardPreferencesService);

  private readonly routeUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  private readonly avatarTrigger = viewChild<ElementRef<HTMLElement>>('avatarTrigger');
  private readonly tabsNav = viewChild<ElementRef<HTMLElement>>('tabsNav');
  private documentsRequested = false;
  private documentOcrWarmupRequested = false;
  private documentReadRequest = 0;
  private avatarFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly user = this.auth.user;
  protected readonly signingOut = signal(false);
  protected readonly uploadingAvatar = signal(false);
  protected readonly cropSource = signal<File | null>(null);
  protected readonly avatarUploaded = signal(false);
  protected readonly profileDirty = signal(false);
  protected readonly savingProfile = signal(false);
  protected readonly profileSaved = signal(false);
  protected readonly savingPassword = signal(false);
  protected readonly passwordSaved = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly uploadingDocument = signal(false);
  protected readonly readingDocument = signal(false);
  protected readonly selectedDocument = signal<File | null>(null);
  protected readonly documentPreviewUrl = signal<string | null>(null);
  protected readonly documentReadState = signal<'idle' | 'found' | 'manual' | 'mismatch'>('idle');
  protected readonly detectedDocumentType = signal<VerificationDocumentType | null>(null);
  protected readonly loadingDocuments = signal(false);
  private readonly documentsLoaded = signal(false);
  protected readonly docs = signal<VerificationDoc[]>([]);
  protected readonly documentVerified = computed(() =>
    /verif|approv/i.test(this.docs()[0]?.status ?? ''),
  );
  protected readonly documentRejected = computed(() =>
    /reject|declin|fail/i.test(this.docs()[0]?.status ?? ''),
  );

  protected docTypeIcon(type: string): string {
    return DOC_TYPE_ICONS[type] ?? 'solarDocumentTextBoldDuotone';
  }

  protected readonly changingDocument = signal(false);
  protected readonly updatingDocument = signal(false);
  protected readonly updateIdentifier = signal('');
  protected readonly updateFile = signal<File | null>(null);
  protected readonly updateRule = computed(() =>
    documentNumberRule((this.docs()[0]?.type ?? 'NIN') as VerificationDocumentType),
  );
  protected readonly updateIdentifierError = computed(() => {
    const doc = this.docs()[0];
    return doc && this.updateIdentifier()
      ? documentNumberError(doc.type as VerificationDocumentType, this.updateIdentifier())
      : null;
  });
  protected readonly pendingDocumentRemoval = signal(false);
  protected readonly selectedType = signal(DOC_TYPES[0]);
  protected readonly documentIdentifier = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly docTypeOptions = DOC_TYPES.map((value) => ({
    value,
    icon: DOC_TYPE_ICONS[value],
  }));
  protected readonly resendingEmail = signal(false);
  protected readonly verificationEmailSent = signal(false);
  protected readonly addressFormOpen = signal(false);
  protected readonly states = signal<Option[]>([]);
  protected readonly cities = signal<Option[]>([]);
  protected readonly loadingStates = signal(false);
  protected readonly loadingCities = signal(false);
  protected readonly savedAddresses = this.addressBook.items;
  protected readonly pendingRemoval = signal<SavedAddress | null>(null);
  protected readonly editingAddress = signal<SavedAddress | null>(null);
  /** State and city are typed by hand only when asked for; a Google suggestion fills them otherwise. */
  protected readonly addressManual = signal(false);
  /** Street, state and city filled in from a Google place; shown over the stored address. */
  private readonly pickedPlace = signal<{ address?: string; state?: string; city?: string } | null>(
    null,
  );
  protected readonly documentIdentifierRule = computed(() =>
    documentNumberRule(this.selectedType()),
  );
  protected readonly documentIdentifierError = computed(() => {
    if (!this.selectedDocument() || this.readingDocument()) return null;
    return documentNumberError(this.selectedType(), this.documentIdentifier());
  });
  protected readonly documentTypeMismatch = computed(() => {
    const detectedType = this.detectedDocumentType();
    return !!detectedType && detectedType !== this.selectedType();
  });
  protected readonly canSubmitDocument = computed(
    () =>
      !!this.selectedDocument() &&
      !this.readingDocument() &&
      !this.documentIdentifierError() &&
      !this.documentTypeMismatch() &&
      !this.uploadingDocument(),
  );

  protected readonly tabs: ReadonlyArray<{ key: SettingsTab; label: string; path: string }> = [
    { key: 'profile', label: 'Profile', path: '/app/profile' },
    { key: 'addresses', label: 'My Addresses', path: '/app/profile/addresses' },
    { key: 'qr', label: 'My QR', path: '/app/profile/qr' },
    { key: 'storefront', label: 'Storefront', path: '/app/profile/storefront' },
    { key: 'appearance', label: 'Appearance', path: '/app/profile/appearance' },
    { key: 'security', label: 'Security', path: '/app/profile/security' },
    { key: 'verification', label: 'Verification', path: '/app/profile/documents' },
  ];

  protected readonly storefrontPage = viewChild(StorefrontSettings);
  protected readonly activeTab = computed<SettingsTab>(() => {
    const url = this.routeUrl();
    if (url.includes('/addresses')) return 'addresses';
    if (url.includes('/qr')) return 'qr';
    if (url.includes('/storefront')) return 'storefront';
    if (url.includes('/security')) return 'security';
    if (url.includes('/documents')) return 'verification';
    if (url.includes('/appearance')) return 'appearance';
    return 'profile';
  });

  protected readonly tabCopy = computed(() => {
    const copy: Record<SettingsTab, { title: string; description: string }> = {
      profile: {
        title: 'Your Profile',
        description: 'Keep the details we use to recognise and reach you up to date.',
      },
      addresses: {
        title: 'My Addresses',
        description: 'Save the places you send parcels from or deliver to often.',
      },
      qr: {
        title: 'My QR',
        description: 'Share a code that opens your profile on Fardelins.',
      },
      storefront: {
        title: 'Storefront',
        description: 'Connect your online store and prepare it for delivery requests.',
      },
      security: {
        title: 'Password & Security',
        description: 'Change the password that protects your account.',
      },
      verification: {
        title: 'Identity Verification',
        description: 'Complete a one-time identity check to keep deliveries secure.',
      },
      appearance: {
        title: 'Appearance',
        description: 'Choose the theme and motion that feel right on this device.',
      },
    };
    return copy[this.activeTab()];
  });

  protected readonly initials = computed(() => {
    const user = this.user();
    if (!user) return '';
    return (
      `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.trim() || user.email.charAt(0)
    ).toUpperCase();
  });

  constructor() {
    this.seo.update({
      title: `Settings | ${SITE_NAME}`,
      description: 'Manage your Fardelins account and preferences.',
      path: '/app/profile',
      robots: 'noindex, nofollow',
    });
    void this.auth.loadProfile().catch(() => undefined);
    effect(() => {
      const user = this.user();
      if (user) this.addressBook.load(user.id);
    });
    effect(() => {
      if (this.activeTab() === 'verification' && !this.documentsRequested) {
        this.documentsRequested = true;
        void this.loadDocuments();
      }
    });
    effect(() => {
      // The reader is about 25 MB, so fetch it early only when the upload form is about to show.
      const formShowing =
        this.activeTab() === 'verification' &&
        this.documentsLoaded() &&
        !this.loadingDocuments() &&
        this.docs().length === 0;
      if (!formShowing || this.documentOcrWarmupRequested || onSlowConnection()) return;
      this.documentOcrWarmupRequested = true;
      void this.documentOcr
        .warmUp()
        .catch((ocrError) => console.warn('[Document OCR] Warm-up failed.', ocrError));
    });
    effect(() => {
      if (this.activeTab() === 'addresses' && !this.states().length && !this.loadingStates()) {
        void this.loadAddressStates();
      }
    });
    effect(() => {
      this.activeTab();
      const nav = this.tabsNav()?.nativeElement;
      if (!nav) return;
      queueMicrotask(() => {
        nav
          .querySelector<HTMLElement>('.settings__tab--active')
          ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      });
    });
    effect((onCleanup) => {
      const file = this.selectedDocument();
      if (!file || !file.type.startsWith('image/')) {
        this.documentPreviewUrl.set(null);
        return;
      }
      const url = URL.createObjectURL(file);
      this.documentPreviewUrl.set(url);
      onCleanup(() => URL.revokeObjectURL(url));
    });
    this.destroyRef.onDestroy(() => {
      if (this.avatarFeedbackTimer) clearTimeout(this.avatarFeedbackTimer);
    });
  }

  protected tapTab(): void {
    this.haptics.selection();
    this.error.set(null);
  }

  protected onAvatar(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.haptics.light();
    this.error.set(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.error.set('Choose a JPG, PNG or WebP image.');
      this.haptics.error();
      input.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.error.set('Choose an image smaller than 10 MB.');
      this.haptics.error();
      input.value = '';
      return;
    }
    this.cropSource.set(file);
    input.value = '';
  }

  protected async uploadCroppedAvatar(file: File): Promise<void> {
    this.cropSource.set(null);
    this.uploadingAvatar.set(true);
    this.avatarUploaded.set(false);
    this.error.set(null);
    try {
      await this.profile.uploadAvatar(file);
      this.avatarUploaded.set(true);
      this.toast.success('Profile photo updated');
      this.haptics.success();
      if (this.avatarFeedbackTimer) clearTimeout(this.avatarFeedbackTimer);
      this.avatarFeedbackTimer = setTimeout(() => this.avatarUploaded.set(false), 1800);
    } catch (error) {
      this.toast.error("Couldn't update your photo", { description: (error as Error).message });
      this.haptics.error();
    } finally {
      this.uploadingAvatar.set(false);
      this.restoreAvatarFocus();
    }
  }

  protected cancelAvatarCrop(): void {
    this.cropSource.set(null);
    this.restoreAvatarFocus();
  }

  private restoreAvatarFocus(): void {
    queueMicrotask(() => this.avatarTrigger()?.nativeElement.focus());
  }

  protected async saveProfile(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.savingProfile() || !this.profileDirty()) return;
    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;
    this.haptics.light();
    const values = new FormData(form);
    this.savingProfile.set(true);
    this.profileSaved.set(false);
    this.error.set(null);
    try {
      await this.profile.update({
        first_name: String(values.get('firstName') ?? '').trim(),
        last_name: String(values.get('lastName') ?? '').trim(),
        phone: String(values.get('phone') ?? '').trim() || undefined,
      });
      await this.auth.loadProfile();
      this.profileDirty.set(false);
      this.profileSaved.set(true);
      this.toast.success('Profile saved');
      this.haptics.success();
      this.appPromo.request('profile-saved');
    } catch (error) {
      this.toast.error("Couldn't save your profile", { description: (error as Error).message });
      this.haptics.error();
    } finally {
      this.savingProfile.set(false);
    }
  }

  protected markProfileDirty(): void {
    this.profileDirty.set(true);
    this.profileSaved.set(false);
  }

  protected async resendVerification(): Promise<void> {
    const email = this.user()?.email;
    if (!email || this.resendingEmail()) return;
    this.resendingEmail.set(true);
    this.error.set(null);
    try {
      await this.auth.resendVerificationEmail(email);
      this.verificationEmailSent.set(true);
      this.haptics.success();
    } catch (error) {
      this.toast.error("Couldn't send the email", { description: (error as Error).message });
      this.haptics.error();
    } finally {
      this.resendingEmail.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    if (this.signingOut()) return;
    this.signingOut.set(true);
    this.haptics.light();
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }

  protected async onStateSelected(option: ComboboxOption): Promise<void> {
    this.cities.set([]);
    this.loadingCities.set(true);
    try {
      this.cities.set(await this.deliveryApi.cities(Number(option.id)));
    } finally {
      this.loadingCities.set(false);
    }
  }

  protected saveAddress(event: SubmitEvent): void {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const manual = this.addressManual();
    const typedState = manual ? this.fieldValue(form, 'state') : this.resolvedPlace('state');
    const state = this.states().find(
      (item) => item.label.toLowerCase() === typedState.toLowerCase(),
    );
    if (!state) {
      this.addressManual.set(true);
      this.error.set(
        manual
          ? 'Pick a state from the list.'
          : 'Pick your address from the suggestions, or choose its state and city.',
      );
      this.haptics.error();
      return;
    }
    this.error.set(null);
    const payload = {
      label: String(values.get('label') ?? '').trim(),
      address: String(values.get('address') ?? '').trim(),
      state: state.label,
      city: manual ? this.fieldValue(form, 'city') : this.resolvedPlace('city'),
    };
    const editing = this.editingAddress();
    if (editing) {
      this.addressBook.update(editing.id, payload);
    } else {
      this.addressBook.add(payload);
    }
    form.reset();
    this.cities.set([]);
    this.pickedPlace.set(null);
    this.editingAddress.set(null);
    this.addressManual.set(false);
    this.addressFormOpen.set(false);
    this.toast.success(editing ? 'Address updated' : 'Address saved', {
      description: payload.label,
    });
    this.haptics.success();
    this.appPromo.request('profile-saved');
  }

  protected toggleAddressForm(): void {
    const next = !this.addressFormOpen();
    this.addressFormOpen.set(next);
    this.pickedPlace.set(null);
    this.addressManual.set(false);
    if (!next) {
      this.editingAddress.set(null);
      this.cities.set([]);
    }
  }

  protected async startEditAddress(address: SavedAddress): Promise<void> {
    this.error.set(null);
    this.pickedPlace.set(null);
    this.addressManual.set(false);
    this.editingAddress.set(address);
    this.addressFormOpen.set(true);
    this.haptics.selection();
    if (!this.states().length && !this.loadingStates()) {
      await this.loadAddressStates();
    }
    const state = this.states().find(
      (item) => item.label.toLowerCase() === address.state.toLowerCase(),
    );
    this.cities.set([]);
    if (!state) return;
    this.loadingCities.set(true);
    try {
      this.cities.set(await this.deliveryApi.cities(Number(state.id)));
    } finally {
      this.loadingCities.set(false);
    }
  }

  protected editingValue(field: 'label' | 'address' | 'state' | 'city'): string {
    const picked = this.pickedPlace();
    const fromPlace = picked && field !== 'label' ? picked[field] : undefined;
    if (fromPlace !== undefined) return fromPlace;
    const address = this.editingAddress();
    if (!address) return '';
    const raw = address[field];
    return field === 'state' || field === 'city' ? this.titleCasePipe.transform(raw) : raw;
  }

  /** Remembers what was typed, or switching to manual entry would reset the street to blank. */
  protected onStreetTyped(value: string): void {
    this.pickedPlace.update((picked) => ({ ...picked, address: value }));
  }

  protected toggleAddressManual(event: Event): void {
    const opening = !this.addressManual();
    // Closing hides the State and City fields, so keep what was chosen in them.
    if (!opening) this.keepManualPlace((event.currentTarget as HTMLElement).closest('form'));
    this.addressManual.set(opening);
    if (opening && !this.states().length && !this.loadingStates()) void this.loadAddressStates();
  }

  private keepManualPlace(form: HTMLFormElement | null): void {
    if (!form) return;
    const state = this.fieldValue(form, 'state');
    const city = this.fieldValue(form, 'city');
    this.pickedPlace.update((picked) => ({ ...picked, ...(state ? { state, city } : {}) }));
  }

  /** A box's text even while it is disabled (a combobox is, whilst its list loads), which FormData skips. */
  private fieldValue(form: HTMLFormElement, name: string): string {
    const field = form.elements.namedItem(name);
    return field instanceof HTMLInputElement ? field.value.trim() : '';
  }

  /** The state or city the form currently stands on: a picked suggestion first, else the saved address. */
  private resolvedPlace(field: 'state' | 'city'): string {
    return this.pickedPlace()?.[field] ?? this.editingAddress()?.[field] ?? '';
  }

  /** "Ikeja, Lagos": what the street field resolved to, shown while State and City are tucked away. */
  protected addressPlace(): string {
    return [this.editingValue('city'), this.editingValue('state')].filter(Boolean).join(', ');
  }

  /** A Google place fills the street, then the state and city it matches in our own lists. */
  protected async onAddressPlace(place: PlaceDetails): Promise<void> {
    if (!this.states().length && !this.loadingStates()) await this.loadAddressStates();
    const state = matchState(this.states(), place.state);
    this.pickedPlace.set({
      address: place.street,
      ...(state ? { state: this.titleCasePipe.transform(state.label), city: '' } : {}),
    });
    if (!state) return;
    await this.onStateSelected({ id: state.id, label: state.label });
    const city = matchCity(this.cities(), place.cityCandidates);
    if (city) {
      this.pickedPlace.update((picked) => ({
        ...picked,
        address: withoutCity(place.street, city.label),
        city: this.titleCasePipe.transform(city.label),
      }));
    }
  }

  protected addressSummary(address: SavedAddress): string {
    const place = [address.city, address.state].filter(Boolean).join(', ');
    return place ? `${address.address}, ${this.titleCasePipe.transform(place)}` : address.address;
  }

  protected confirmRemoveAddress(): void {
    const address = this.pendingRemoval();
    if (!address) return;
    const index = this.savedAddresses().findIndex((item) => item.id === address.id);
    this.addressBook.remove(address.id);
    this.pendingRemoval.set(null);
    this.toast.success('Address removed', {
      description: address.label,
      actions: [{ label: 'Undo', run: () => this.addressBook.restore(address, index) }],
    });
    this.haptics.light();
  }

  protected async savePassword(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.savingPassword()) return;
    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const next = String(values.get('newPassword') ?? '');
    if (next !== String(values.get('confirmPassword') ?? '')) {
      this.error.set('Those passwords do not match.');
      this.haptics.error();
      return;
    }
    this.haptics.light();
    this.savingPassword.set(true);
    this.passwordSaved.set(false);
    this.error.set(null);
    try {
      await this.profile.updatePassword(String(values.get('currentPassword') ?? ''), next);
      this.passwordSaved.set(true);
      this.toast.success('Password updated');
      this.haptics.success();
      form.reset();
    } catch (error) {
      this.toast.error("Couldn't update your password", { description: (error as Error).message });
      this.haptics.error();
    } finally {
      this.savingPassword.set(false);
    }
  }

  protected setPasswordValidity(input: HTMLInputElement): void {
    if (!input.validity.tooShort) return;
    input.setCustomValidity(`Use at least ${input.minLength} characters.`);
  }

  protected selectDocumentType(documentType: VerificationDocumentType): void {
    if (this.selectedType() === documentType) return;
    this.selectedType.set(documentType);
    this.documentIdentifier.update((value) => normalizeDocumentNumber(documentType, value));
    this.error.set(null);

    const detectedType = this.detectedDocumentType();
    if (!this.selectedDocument() || this.readingDocument()) return;
    if (detectedType && detectedType !== documentType) {
      this.documentReadState.set('mismatch');
    } else {
      this.documentReadState.set(this.documentIdentifier() ? 'found' : 'manual');
    }
  }

  protected async onDocument(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.haptics.light();
    input.value = '';

    if (!ACCEPTED_DOCUMENT_TYPES.includes(file.type)) {
      this.error.set('Choose a JPG or PDF document.');
      this.haptics.error();
      return;
    }
    if (file.size > MAX_DOCUMENT_SIZE) {
      this.error.set('Choose a document smaller than 3 MB.');
      this.haptics.error();
      return;
    }

    const request = ++this.documentReadRequest;
    this.selectedDocument.set(file);
    this.documentIdentifier.set('');
    this.detectedDocumentType.set(null);
    this.documentReadState.set('idle');
    this.readingDocument.set(true);
    this.error.set(null);

    const scanPromise = this.documentOcr.scanDocument(file, this.selectedType());
    try {
      const scan = await Promise.race([
        scanPromise,
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Document scan timed out.')), OCR_SCAN_TIMEOUT_MS);
        }),
      ]);
      if (request !== this.documentReadRequest) return;
      this.applyDocumentScan(scan);
    } catch (ocrError) {
      if (request !== this.documentReadRequest) return;
      console.warn('[Document OCR] Falling back to manual entry.', ocrError);
      this.documentReadState.set('manual');
      if ((ocrError as Error).message === 'Document scan timed out.') {
        void scanPromise
          .then((scan) => {
            if (request !== this.documentReadRequest) return;
            this.applyDocumentScan(scan, true);
          })
          .catch((lateError) => console.warn('[Document OCR] Background scan failed.', lateError));
      }
    } finally {
      if (request === this.documentReadRequest) this.readingDocument.set(false);
    }
  }

  protected onDocumentIdentifierInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const normalized = normalizeDocumentNumber(this.selectedType(), input.value);
    this.documentIdentifier.set(normalized);
    input.value = normalized;
    this.error.set(null);
  }

  private applyDocumentScan(scan: DocumentScanResult, preserveManualIdentifier = false): void {
    this.detectedDocumentType.set(scan.detectedType);
    if (scan.identifier && (!preserveManualIdentifier || !this.documentIdentifier())) {
      this.documentIdentifier.set(
        normalizeDocumentNumber(scan.detectedType ?? this.selectedType(), scan.identifier),
      );
    }
    if (scan.detectedType && scan.detectedType !== this.selectedType()) {
      this.documentReadState.set('mismatch');
      this.haptics.error();
    } else if (scan.identifier) {
      this.documentReadState.set('found');
      this.haptics.success();
    } else {
      this.documentReadState.set('manual');
    }
  }

  protected removeDocument(): void {
    this.documentReadRequest += 1;
    this.selectedDocument.set(null);
    this.documentIdentifier.set('');
    this.detectedDocumentType.set(null);
    this.readingDocument.set(false);
    this.documentReadState.set('idle');
    this.error.set(null);
    this.haptics.light();
  }

  protected formatDocumentSize(file: File): string {
    return file.size < 1024 * 1024
      ? `${Math.ceil(file.size / 1024)} KB`
      : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected async submitDocument(): Promise<void> {
    const file = this.selectedDocument();
    const identifier = normalizeDocumentNumber(this.selectedType(), this.documentIdentifier());
    const validationError = documentNumberError(this.selectedType(), identifier);
    if (
      !file ||
      this.readingDocument() ||
      this.documentTypeMismatch() ||
      this.uploadingDocument()
    ) {
      return;
    }
    if (validationError) {
      this.error.set(validationError);
      this.haptics.error();
      return;
    }

    this.documentReadRequest += 1;
    this.readingDocument.set(false);
    this.uploadingDocument.set(true);
    this.error.set(null);
    this.haptics.light();
    try {
      await this.profile.uploadDocument(file, this.selectedType(), identifier);
      this.documentIdentifier.set('');
      this.selectedDocument.set(null);
      this.detectedDocumentType.set(null);
      this.documentReadState.set('idle');
      await this.loadDocuments();
      this.toast.success('Document submitted', {
        description: "You'll see the review result on this page.",
      });
      this.haptics.success();
    } catch (error) {
      this.toast.error("Couldn't submit your document", { description: (error as Error).message });
      this.haptics.error();
    } finally {
      this.uploadingDocument.set(false);
    }
  }

  protected maskedIdentifier(doc: VerificationDoc): string | null {
    return doc.identifier ? maskDocumentNumber(doc.identifier) : null;
  }

  protected openDocumentUpdate(): void {
    this.updateIdentifier.set('');
    this.updateFile.set(null);
    this.updatingDocument.set(true);
    this.haptics.light();
  }

  protected onUpdateIdentifier(event: Event): void {
    const doc = this.docs()[0];
    const input = event.target as HTMLInputElement;
    const normalized = normalizeDocumentNumber(doc.type as VerificationDocumentType, input.value);
    this.updateIdentifier.set(normalized);
    input.value = normalized;
  }

  protected onUpdateFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!ACCEPTED_DOCUMENT_TYPES.includes(file.type)) {
      this.toast.error('Choose a JPG or PDF document');
      this.haptics.error();
      return;
    }
    if (file.size > MAX_DOCUMENT_SIZE) {
      this.toast.error('Choose a document smaller than 3 MB');
      this.haptics.error();
      return;
    }
    this.updateFile.set(file);
  }

  protected async saveDocumentUpdate(): Promise<void> {
    const doc = this.docs()[0];
    const file = this.updateFile();
    const identifier = this.updateIdentifier();
    if (!doc || (!file && !identifier) || this.updateIdentifierError() || this.changingDocument())
      return;

    this.changingDocument.set(true);
    try {
      await this.profile.updateDocument(doc, {
        identifier: identifier || undefined,
        file: file ?? undefined,
      });
      this.updatingDocument.set(false);
      await this.loadDocuments();
      this.toast.success('Document updated', { description: "We'll review the new details." });
      this.haptics.success();
    } catch (error) {
      this.toast.error("Couldn't update your document", { description: (error as Error).message });
      this.haptics.error();
    } finally {
      this.changingDocument.set(false);
    }
  }

  protected async confirmRemoveDocument(): Promise<void> {
    const doc = this.docs()[0];
    this.pendingDocumentRemoval.set(false);
    if (!doc || this.changingDocument()) return;

    this.changingDocument.set(true);
    try {
      await this.profile.deleteDocument(doc.id);
      await this.loadDocuments();
      this.toast.success('Document removed', { description: 'You can submit a new one now.' });
      this.haptics.light();
    } catch (error) {
      this.toast.error("Couldn't remove your document", { description: (error as Error).message });
      this.haptics.error();
    } finally {
      this.changingDocument.set(false);
    }
  }

  protected selectTheme(theme: ThemePreference): void {
    if (this.preferences.theme() === theme) return;
    this.haptics.selection();
    this.preferences.setTheme(theme);
  }

  protected toggleMotion(): void {
    this.haptics.selection();
    this.preferences.setMotionEnabled(!this.preferences.motionEnabled());
  }

  protected toggleSpendVisibility(): void {
    this.haptics.selection();
    this.preferences.setSpendVisible(!this.preferences.spendVisible());
  }

  private async loadDocuments(): Promise<void> {
    this.loadingDocuments.set(true);
    try {
      this.docs.set(await this.profile.documents());
    } finally {
      this.loadingDocuments.set(false);
      this.documentsLoaded.set(true);
    }
  }

  private async loadAddressStates(): Promise<void> {
    this.loadingStates.set(true);
    try {
      this.states.set(await this.deliveryApi.states());
    } catch {
      this.error.set("We couldn't load states for a new address.");
    } finally {
      this.loadingStates.set(false);
    }
  }
}
