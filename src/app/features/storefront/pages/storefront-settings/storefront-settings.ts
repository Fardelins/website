import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarAddCircleBoldDuotone,
  solarAltArrowDownBoldDuotone,
  solarAltArrowLeftBoldDuotone,
  solarCheckCircleBoldDuotone,
  solarCloseCircleBoldDuotone,
  solarCodeFileBoldDuotone,
  solarCopyBoldDuotone,
  solarDangerCircleBoldDuotone,
  solarEyeBoldDuotone,
  solarEyeClosedBoldDuotone,
  solarInfoCircleBoldDuotone,
  solarKeyBoldDuotone,
  solarLinkBoldDuotone,
  solarMagniferBoldDuotone,
  solarMapPointWaveBoldDuotone,
  solarPenBoldDuotone,
  solarRefreshBoldDuotone,
  solarShieldCheckBoldDuotone,
  solarShop2BoldDuotone,
  solarStarBoldDuotone,
  solarTrashBinTrashBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { CountryCode, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js';
import { AuthService } from '@core/auth/auth.service';
import { SavedAddressesService } from '@core/services/saved-addresses.service';
import { HapticsService } from '@core/services/haptics.service';
import { LOGISTICS_API_ORIGIN } from '@core/services/logistics-api.config';
import { ToastService } from '@core/services/toast.service';
import { EmptyState } from '@shared/components/empty-state/empty-state';
import { Logo } from '@shared/components/logo/logo';
import { PhoneInput } from '@shared/components/phone-input/phone-input';
import { PortalToShellDirective } from '@shared/directives/portal-to-shell.directive';
import { PreferredCourier, Storefront, StorefrontInput } from '../../storefront.models';
import { StorefrontService } from '../../storefront.service';
import {
  HandoffCopyTarget,
  StorefrontConnectionHandoff,
} from '../../components/storefront-connection-handoff/storefront-connection-handoff';
import { StorefrontSelector } from '../../components/storefront-selector/storefront-selector';

type ConfirmAction = 'delete' | 'regenerate' | null;
type CopyTarget = 'property-id' | 'api-key' | 'base-url' | 'snippet' | 'env' | null;
const COPY_TOASTS: Record<Exclude<CopyTarget, null>, string> = {
  'property-id': 'Property ID copied',
  'api-key': 'API key copied',
  'base-url': 'Base URL copied',
  snippet: 'Test request copied',
  env: '.env values copied',
};
type OverviewTab = 'integration' | 'details';
type ConnectionStage = 'form' | 'connecting' | 'connected';

@Component({
  selector: 'app-storefront-settings',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIcon,
    PhoneInput,
    EmptyState,
    NgTemplateOutlet,
    Logo,
    PortalToShellDirective,
    StorefrontConnectionHandoff,
    StorefrontSelector,
  ],
  viewProviders: [
    provideIcons({
      solarAddCircleBoldDuotone,
      solarAltArrowDownBoldDuotone,
      solarAltArrowLeftBoldDuotone,
      solarCheckCircleBoldDuotone,
      solarCloseCircleBoldDuotone,
      solarCodeFileBoldDuotone,
      solarCopyBoldDuotone,
      solarDangerCircleBoldDuotone,
      solarEyeBoldDuotone,
      solarEyeClosedBoldDuotone,
      solarInfoCircleBoldDuotone,
      solarKeyBoldDuotone,
      solarLinkBoldDuotone,
      solarMagniferBoldDuotone,
      solarMapPointWaveBoldDuotone,
      solarPenBoldDuotone,
      solarRefreshBoldDuotone,
      solarShieldCheckBoldDuotone,
      solarShop2BoldDuotone,
      solarStarBoldDuotone,
      solarTrashBinTrashBoldDuotone,
    }),
  ],
  templateUrl: './storefront-settings.html',
  styleUrls: [
    '../../../../shared/styles/forms.css',
    './storefront-settings.css',
    './storefront-integration.css',
    './storefront-dialog.css',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorefrontSettings {
  private readonly api = inject(StorefrontService);
  private readonly auth = inject(AuthService);
  private readonly addresses = inject(SavedAddressesService);
  private readonly haptics = inject(HapticsService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private copyTimer: ReturnType<typeof setTimeout> | null = null;
  private keyTimer: ReturnType<typeof setTimeout> | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly addressPickerEl = viewChild<ElementRef<HTMLElement>>('addressPicker');

  protected readonly apiBaseUrl = `${LOGISTICS_API_ORIGIN}/v1`;
  protected readonly savedAddresses = this.addresses.items;
  protected readonly storefronts = signal<Storefront[]>([]);
  protected readonly couriers = signal<PreferredCourier[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly formStorefrontId = signal<string | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly formStep = signal<1 | 2>(1);
  protected readonly connectionStage = signal<ConnectionStage>('form');
  protected readonly connectedStorefront = signal<Storefront | null>(null);
  protected readonly connectionKeyError = signal<string | null>(null);
  protected readonly preparingConnectionKey = signal(false);
  protected readonly loading = signal(true);
  protected readonly loadingCouriers = signal(true);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly dirty = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly revealingKey = signal(false);
  protected readonly generatingKey = signal(false);
  protected readonly deleting = signal(false);
  protected readonly apiKey = signal<string | null>(null);
  protected readonly copied = signal<CopyTarget>(null);
  protected readonly overviewTab = signal<OverviewTab>('integration');
  protected readonly overviewTabs: { id: OverviewTab; label: string }[] = [
    { id: 'integration', label: 'Integration' },
    { id: 'details', label: 'Store Details' },
  ];
  protected readonly confirmAction = signal<ConfirmAction>(null);
  protected readonly phoneCountry = signal<CountryCode>('NG');
  protected readonly phoneNumber = signal('');
  protected readonly selectedCourierIds = signal<readonly string[]>([]);
  protected readonly addressMode = signal<'saved' | 'custom'>('saved');
  protected readonly addressPickerOpen = signal(false);
  protected readonly selectedAddressId = signal<string | null>(null);
  protected readonly courierSearch = signal('');
  protected readonly courierPage = signal(1);
  protected readonly hasMoreCouriers = signal(false);
  protected readonly loadingMoreCouriers = signal(false);
  private static readonly COURIER_PAGE_SIZE = 8;

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(160)]],
    website: ['', [websiteValidator]],
    description: ['', [Validators.maxLength(500)]],
    address: ['', [Validators.maxLength(255)]],
  });

  protected readonly selectedStorefront = computed(() => {
    const id = this.selectedId();
    return this.storefronts().find((item) => item.id === id) ?? this.storefronts()[0] ?? null;
  });
  protected readonly editing = computed(() => this.formStorefrontId() !== null);
  protected readonly phoneIsValid = computed(
    () => this.phoneNumber().replace(/\D/g, '').length >= 7,
  );
  protected readonly canSave = computed(
    () => this.dirty() && this.form.valid && this.phoneIsValid() && !this.saving(),
  );
  protected readonly step1Valid = computed(
    () => this.form.controls.name.valid && this.form.controls.email.valid && this.phoneIsValid(),
  );
  protected readonly saveLabel = computed(() => {
    if (this.saving()) return 'Saving...';
    if (this.saved()) return 'Saved';
    return this.editing() ? 'Save Changes' : 'Add Storefront';
  });
  protected readonly selectedCourierNames = computed(() => {
    const ids = new Set(this.selectedStorefront()?.preferredCourierIds ?? []);
    return this.couriers()
      .filter((courier) => ids.has(courier.id))
      .map((courier) => courier.name);
  });
  protected readonly connectedCourierNames = computed(() => {
    const ids = new Set(this.connectedStorefront()?.preferredCourierIds ?? []);
    return this.couriers()
      .filter((courier) => ids.has(courier.id))
      .map((courier) => courier.name);
  });
  protected readonly handoffCopied = computed<HandoffCopyTarget | null>(() => {
    const target = this.copied();
    return target === 'property-id' || target === 'api-key' ? target : null;
  });
  protected readonly selectedAddress = computed(() =>
    this.savedAddresses().find((item) => item.id === this.selectedAddressId()),
  );
  protected readonly filteredCouriers = computed(() => {
    const term = this.courierSearch().trim().toLowerCase();
    const list = this.couriers();
    return term ? list.filter((courier) => courier.name.toLowerCase().includes(term)) : list;
  });
  protected readonly envSnippet = computed(() => this.envLines('YOUR_API_KEY'));
  readonly hasStorefronts = computed(() => this.storefronts().length > 0);
  protected readonly integrationSnippet = computed(() => {
    const propertyId = this.selectedStorefront()?.id ?? 'YOUR_PROPERTY_ID';
    return [
      `curl ${this.apiBaseUrl}/customer-property/test \\`,
      `  -H "x-customer-prop-Id: ${propertyId}" \\`,
      '  -H "x-customer-prop-key: YOUR_API_KEY"',
    ].join('\n');
  });

  private envLines(key: string): string {
    const propertyId = this.selectedStorefront()?.id ?? '';
    return [
      `FARDELINS_API_URL=${this.apiBaseUrl}`,
      `FARDELINS_PROPERTY_ID=${propertyId}`,
      `FARDELINS_API_KEY=${key}`,
    ].join('\n');
  }

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.markDirty());
    this.destroyRef.onDestroy(() => {
      if (this.copyTimer) clearTimeout(this.copyTimer);
      if (this.keyTimer) clearTimeout(this.keyTimer);
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.apiKey.set(null);
    });
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const storefrontRequest = this.api.list();
    const courierRequest = this.loadCouriers();
    try {
      const storefronts = await storefrontRequest;
      this.storefronts.set(storefronts);
      const active = this.selectedId();
      this.selectedId.set(
        storefronts.some((item) => item.id === active) ? active : (storefronts[0]?.id ?? null),
      );
    } catch (error) {
      this.error.set((error as Error).message);
    } finally {
      this.loading.set(false);
    }
    await courierRequest;
  }

  protected async loadCouriers(): Promise<void> {
    this.loadingCouriers.set(true);
    try {
      const couriers = await this.api.preferredCouriers(1, StorefrontSettings.COURIER_PAGE_SIZE);
      this.couriers.set(couriers);
      this.courierPage.set(1);
      this.hasMoreCouriers.set(couriers.length === StorefrontSettings.COURIER_PAGE_SIZE);
    } catch (error) {
      this.toast.error("Couldn't load couriers", {
        description: (error as Error).message,
        actions: [{ label: 'Try again', run: () => void this.loadCouriers() }],
      });
    } finally {
      this.loadingCouriers.set(false);
    }
  }

  protected async loadMoreCouriers(): Promise<void> {
    if (this.loadingMoreCouriers() || !this.hasMoreCouriers()) return;
    this.loadingMoreCouriers.set(true);
    try {
      const nextPage = this.courierPage() + 1;
      const more = await this.api.preferredCouriers(nextPage, StorefrontSettings.COURIER_PAGE_SIZE);
      this.couriers.update((list) => {
        const knownIds = new Set(list.map((courier) => courier.id));
        return [...list, ...more.filter((courier) => !knownIds.has(courier.id))];
      });
      this.courierPage.set(nextPage);
      this.hasMoreCouriers.set(more.length === StorefrontSettings.COURIER_PAGE_SIZE);
      if (more.length) this.haptics.light();
    } catch (error) {
      this.toast.error("Couldn't load more couriers", {
        description: (error as Error).message,
        actions: [{ label: 'Try again', run: () => void this.loadMoreCouriers() }],
      });
    } finally {
      this.loadingMoreCouriers.set(false);
    }
  }

  protected selectStorefront(id: string): void {
    if (this.selectedId() === id && !this.formOpen()) return;
    this.selectedId.set(id);
    this.formOpen.set(false);
    this.formStorefrontId.set(null);
    this.clearSensitiveState();
    this.error.set(null);
    this.haptics.selection();
  }

  openCreate(): void {
    const user = this.auth.user();
    this.form.reset(
      {
        name: '',
        email: user?.email ?? '',
        website: '',
        description: '',
        address: '',
      },
      { emitEvent: false },
    );
    this.setPhone(user?.phone ?? '');
    this.selectedCourierIds.set([]);
    this.courierSearch.set('');
    this.resetAddressPicker('');
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.formStorefrontId.set(null);
    this.formStep.set(1);
    this.connectionStage.set('form');
    this.connectedStorefront.set(null);
    this.connectionKeyError.set(null);
    this.formOpen.set(true);
    this.dirty.set(false);
    this.saved.set(false);
    this.error.set(null);
    this.clearSensitiveState();
    this.haptics.light();
  }

  protected openEdit(): void {
    const storefront = this.selectedStorefront();
    if (!storefront) return;
    this.form.reset(
      {
        name: storefront.name,
        email: storefront.email,
        website: storefront.website ?? '',
        description: storefront.description ?? '',
        address: storefront.location?.address ?? '',
      },
      { emitEvent: false },
    );
    this.setPhone(storefront.phone);
    this.selectedCourierIds.set([...storefront.preferredCourierIds]);
    this.courierSearch.set('');
    this.resetAddressPicker(storefront.location?.address ?? '');
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.formStorefrontId.set(storefront.id);
    this.formStep.set(1);
    this.formOpen.set(true);
    this.dirty.set(false);
    this.saved.set(false);
    this.error.set(null);
    this.clearSensitiveState();
    this.haptics.selection();
  }

  protected cancelForm(): void {
    if (this.saving() || this.preparingConnectionKey()) return;
    this.formOpen.set(false);
    this.formStorefrontId.set(null);
    this.connectionStage.set('form');
    this.connectedStorefront.set(null);
    this.connectionKeyError.set(null);
    this.dirty.set(false);
    this.saved.set(false);
    this.error.set(null);
    this.haptics.light();
  }

  protected goToStep2(): void {
    this.form.controls.name.markAsTouched();
    this.form.controls.email.markAsTouched();
    if (!this.step1Valid()) {
      this.haptics.error();
      return;
    }
    this.formStep.set(2);
    this.haptics.light();
  }

  protected goToStep1(): void {
    this.formStep.set(1);
    this.haptics.light();
  }

  protected changePhoneCountry(country: CountryCode): void {
    this.phoneCountry.set(country);
    this.markDirty();
  }

  protected changePhone(value: string): void {
    this.phoneNumber.set(value);
    this.markDirty();
  }

  protected toggleAddressPicker(): void {
    if (!this.savedAddresses().length) return;
    this.addressPickerOpen.update((open) => !open);
  }

  protected chooseSavedAddress(id: string): void {
    const address = this.savedAddresses().find((item) => item.id === id);
    if (!address) return;
    const place = [address.city, address.state].filter(Boolean).join(', ');
    this.form.controls.address.setValue(place ? `${address.address}, ${place}` : address.address);
    this.selectedAddressId.set(id);
    this.addressMode.set('saved');
    this.addressPickerOpen.set(false);
    this.haptics.selection();
  }

  protected chooseCustomAddress(): void {
    this.addressMode.set('custom');
    this.selectedAddressId.set(null);
    this.addressPickerOpen.set(false);
    this.form.controls.address.setValue('');
    this.haptics.selection();
  }

  @HostListener('document:pointerdown', ['$event'])
  protected onDocumentPointerDown(event: PointerEvent): void {
    if (!this.addressPickerOpen()) return;
    const el = this.addressPickerEl()?.nativeElement;
    if (el && !el.contains(event.target as Node)) this.addressPickerOpen.set(false);
  }

  private resetAddressPicker(currentAddress: string): void {
    this.addressPickerOpen.set(false);
    const match = currentAddress
      ? this.savedAddresses().find((item) => item.address === currentAddress)
      : undefined;
    if (match) {
      this.addressMode.set('saved');
      this.selectedAddressId.set(match.id);
    } else if (currentAddress) {
      this.addressMode.set('custom');
      this.selectedAddressId.set(null);
    } else {
      this.addressMode.set(this.savedAddresses().length ? 'saved' : 'custom');
      this.selectedAddressId.set(null);
    }
  }

  protected toggleCourier(id: string): void {
    this.selectedCourierIds.update((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
    this.markDirty();
    this.haptics.selection();
  }

  protected courierSelected(id: string): boolean {
    return this.selectedCourierIds().includes(id);
  }

  protected async saveStorefront(): Promise<void> {
    if (this.saving()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.phoneIsValid()) {
      this.error.set('Check the highlighted details and try again.');
      this.haptics.error();
      return;
    }

    const value = this.form.getRawValue();
    const input: StorefrontInput = {
      name: value.name,
      email: value.email,
      phone: this.formattedPhone(),
      ...(value.website.trim() ? { website: normalizeWebsite(value.website) } : {}),
      ...(value.description.trim() ? { description: value.description.trim() } : {}),
      ...(value.address.trim() ? { location: { address: value.address.trim() } } : {}),
      ...(this.selectedCourierIds().length
        ? { preferred_courier_ids: [...this.selectedCourierIds()] }
        : {}),
    };

    this.saving.set(true);
    this.saved.set(false);
    this.error.set(null);
    const editingId = this.formStorefrontId();
    if (!editingId) this.connectionStage.set('connecting');
    try {
      const storefront = editingId
        ? await this.api.update(editingId, input)
        : await this.api.create(input);
      if (storefront) {
        this.storefronts.update((items) => {
          const exists = items.some((item) => item.id === storefront.id);
          return exists
            ? items.map((item) => (item.id === storefront.id ? storefront : item))
            : [...items, storefront];
        });
        this.selectedId.set(storefront.id);
      } else {
        const items = await this.api.list();
        this.storefronts.set(items);
        this.selectedId.set(editingId ?? items.at(-1)?.id ?? items[0]?.id ?? null);
      }
      this.saved.set(true);
      this.dirty.set(false);
      this.form.markAsPristine();
      this.haptics.success();
      if (editingId) {
        this.toast.success('Storefront updated', { description: storefront?.name });
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
          this.saved.set(false);
          this.formOpen.set(false);
          this.formStorefrontId.set(null);
        }, 1200);
      } else {
        const created = storefront ?? this.selectedStorefront();
        if (!created) throw new Error("Your storefront was added, but we couldn't open it.");
        this.connectedStorefront.set(created);
        await this.prepareConnectionKey(created.id);
        this.connectionStage.set('connected');
      }
    } catch (error) {
      this.error.set((error as Error).message);
      if (!editingId && !this.connectedStorefront()) this.connectionStage.set('form');
      this.haptics.error();
    } finally {
      this.saving.set(false);
    }
  }

  protected async retryConnectionKey(): Promise<void> {
    const storefront = this.connectedStorefront();
    if (!storefront || this.preparingConnectionKey()) return;
    await this.prepareConnectionKey(storefront.id);
  }

  protected openConnectedStorefront(): void {
    const storefront = this.connectedStorefront();
    if (storefront) this.selectedId.set(storefront.id);
    this.closeConnectionHandoff();
    this.apiKey.set(null);
    this.haptics.light();
  }

  protected requestDelete(): void {
    if (!this.selectedStorefront()) return;
    this.confirmAction.set('delete');
    this.haptics.light();
  }

  protected requestRegeneration(): void {
    if (!this.selectedStorefront()) return;
    this.confirmAction.set('regenerate');
    this.haptics.light();
  }

  protected closeConfirmation(): void {
    if (this.deleting() || this.generatingKey()) return;
    this.confirmAction.set(null);
  }

  protected async confirm(): Promise<void> {
    if (this.confirmAction() === 'delete') {
      await this.deleteStorefront();
    } else if (this.confirmAction() === 'regenerate') {
      await this.regenerateKey();
    }
  }

  protected async toggleKey(): Promise<void> {
    if (this.apiKey()) {
      this.clearKey();
      return;
    }
    const storefront = this.selectedStorefront();
    if (!storefront || this.revealingKey()) return;
    this.revealingKey.set(true);
    try {
      this.apiKey.set(await this.api.revealKey(storefront.id));
      this.armKeyTimer();
      this.haptics.light();
    } catch (error) {
      this.toast.error("Couldn't show the API key", { description: (error as Error).message });
      this.haptics.error();
    } finally {
      this.revealingKey.set(false);
    }
  }

  protected async copyText(value: string, target: Exclude<CopyTarget, null>): Promise<void> {
    try {
      if (!globalThis.navigator?.clipboard) throw new Error('Clipboard unavailable');
      await globalThis.navigator.clipboard.writeText(value);
      this.copied.set(target);
      this.toast.success(COPY_TOASTS[target]);
      this.haptics.success();
      if (this.copyTimer) clearTimeout(this.copyTimer);
      this.copyTimer = setTimeout(() => this.copied.set(null), 1600);
    } catch {
      this.toast.error("Couldn't copy", {
        description: 'Copy is unavailable here. Select the value and copy it manually.',
      });
      this.haptics.error();
    }
  }

  protected openWebsite(website: string): void {
    if (!globalThis.window) return;
    window.open(normalizeWebsite(website), '_blank', 'noopener,noreferrer');
  }

  private async deleteStorefront(): Promise<void> {
    const storefront = this.selectedStorefront();
    if (!storefront || this.deleting()) return;
    this.deleting.set(true);
    this.error.set(null);
    try {
      await this.api.remove(storefront.id);
      this.storefronts.update((items) => items.filter((item) => item.id !== storefront.id));
      this.selectedId.set(this.storefronts()[0]?.id ?? null);
      this.confirmAction.set(null);
      this.clearSensitiveState();
      this.toast.success('Storefront removed', { description: storefront.name });
      this.haptics.success();
    } catch (error) {
      this.toast.error("Couldn't remove the storefront", { description: (error as Error).message });
      this.haptics.error();
    } finally {
      this.deleting.set(false);
    }
  }

  private async regenerateKey(): Promise<void> {
    const storefront = this.selectedStorefront();
    if (!storefront || this.generatingKey()) return;
    this.generatingKey.set(true);
    try {
      this.apiKey.set(await this.api.generateKey(storefront.id));
      this.confirmAction.set(null);
      this.armKeyTimer();
      this.toast.success('New API key generated', {
        description: 'Copy it now. It hides again in 30 seconds.',
      });
      this.haptics.success();
    } catch (error) {
      this.toast.error("Couldn't generate a new key", { description: (error as Error).message });
      this.haptics.error();
    } finally {
      this.generatingKey.set(false);
    }
  }

  private async prepareConnectionKey(id: string): Promise<void> {
    this.preparingConnectionKey.set(true);
    this.connectionKeyError.set(null);
    try {
      this.apiKey.set(await this.api.generateKey(id));
      this.armKeyTimer();
    } catch (error) {
      this.connectionKeyError.set((error as Error).message);
    } finally {
      this.preparingConnectionKey.set(false);
    }
  }

  private closeConnectionHandoff(): void {
    this.formOpen.set(false);
    this.formStorefrontId.set(null);
    this.connectionStage.set('form');
    this.connectedStorefront.set(null);
    this.connectionKeyError.set(null);
    this.saved.set(false);
  }

  private setPhone(phone: string): void {
    const parsed = parsePhoneNumberFromString(phone);
    this.phoneCountry.set(parsed?.country ?? 'NG');
    this.phoneNumber.set(parsed?.nationalNumber ?? phone.replace(/^\+\d{1,3}/, ''));
  }

  private formattedPhone(): string {
    const callingCode = getCountryCallingCode(this.phoneCountry());
    return `+${callingCode}${this.phoneNumber().replace(/\D/g, '').replace(/^0+/, '')}`;
  }

  private markDirty(): void {
    this.dirty.set(true);
    this.saved.set(false);
  }

  private clearSensitiveState(): void {
    this.clearKey();
    this.copied.set(null);
  }

  private clearKey(): void {
    this.apiKey.set(null);
    if (this.keyTimer) clearTimeout(this.keyTimer);
    this.keyTimer = null;
  }

  private armKeyTimer(): void {
    if (this.keyTimer) clearTimeout(this.keyTimer);
    this.keyTimer = setTimeout(() => this.apiKey.set(null), 30_000);
  }
}

function websiteValidator(control: AbstractControl<string>): ValidationErrors | null {
  const value = control.value.trim();
  if (!value) return null;
  try {
    const url = new URL(normalizeWebsite(value));
    return url.hostname.includes('.') ? null : { website: true };
  } catch {
    return { website: true };
  }
}

function normalizeWebsite(value: string): string {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
