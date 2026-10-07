import { TitleCasePipe } from '@angular/common';
import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarAddCircleBoldDuotone,
  solarAltArrowRightBoldDuotone,
  solarCloseCircleBoldDuotone,
  solarDangerCircleBoldDuotone,
  solarFilterBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { SITE_NAME, SeoService } from '@core/services/seo.service';
import { EmptyState } from '@shared/components/empty-state/empty-state';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { StatusPill } from '@shared/components/status-pill/status-pill';
import { TrackingCopy } from '@shared/components/tracking-copy/tracking-copy';
import { Option } from '@features/send-delivery/send-delivery.model';
import { SendDeliveryService } from '@features/send-delivery/send-delivery.service';
import { DeliveriesService } from '../../deliveries.service';
import {
  DeliverySummary,
  EMPTY_PARCEL_FILTERS,
  ParcelFilters,
  formatMoney,
  hasParcelFilters,
} from '../../deliveries.model';

type Filter = 'all' | 'ongoing' | 'delivered' | 'cancelled';
type FilterGroup = 'date' | 'amount' | 'destination';

const DATE_PRESETS = [
  { key: '7', label: 'Last 7 days' },
  { key: '30', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
] as const;

/** Local calendar day as YYYY-MM-DD, the format a date input and the API both use. */
function isoDay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Built from parts, not `new Date('YYYY-MM-DD')`, which is UTC and can show the day before. */
function dayLabel(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

const ONGOING = ['pending', 'assigned', 'picked_up', 'enroute', 'office', 'at_office', 'delivered'];
const DONE = ['received', 'completed'];
const PAGE_SIZE = 7;
const ACTIVE_PRIORITY: Record<string, number> = {
  delivered: 0,
  enroute: 1,
  picked_up: 2,
  assigned: 3,
  office: 4,
  at_office: 4,
  pending: 5,
};

@Component({
  selector: 'app-deliveries-list',
  imports: [RouterLink, NgIcon, StatusPill, EmptyState, Skeleton, TrackingCopy, TitleCasePipe],
  viewProviders: [
    provideIcons({
      solarDangerCircleBoldDuotone,
      solarAddCircleBoldDuotone,
      solarAltArrowRightBoldDuotone,
      solarCloseCircleBoldDuotone,
      solarFilterBoldDuotone,
    }),
  ],
  templateUrl: './deliveries-list.html',
  styleUrls: ['../../../../shared/styles/forms.css', './deliveries-list.css'],
})
export class DeliveriesList {
  private readonly deliveries = inject(DeliveriesService);
  private readonly seo = inject(SeoService);
  private readonly route = inject(ActivatedRoute);
  private readonly locations = inject(SendDeliveryService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly datePresets = DATE_PRESETS;
  protected readonly filtersOpen = signal(false);
  // The panel edits `draft`; nothing reaches the API until "Show results" copies it to `applied`.
  protected readonly applied = signal<ParcelFilters>(EMPTY_PARCEL_FILTERS);
  protected readonly draft = signal<ParcelFilters>(EMPTY_PARCEL_FILTERS);
  protected readonly states = signal<Option[]>([]);
  protected readonly cities = signal<Option[]>([]);
  protected readonly loadingCities = signal(false);

  protected readonly chips = computed<{ key: FilterGroup; label: string }[]>(() => {
    const { dateFrom, dateTo, minPrice, maxPrice, state, city } = this.applied();
    const chips: { key: FilterGroup; label: string }[] = [];
    if (dateFrom || dateTo) {
      chips.push({
        key: 'date',
        label:
          dateFrom && dateTo
            ? `${dayLabel(dateFrom)} to ${dayLabel(dateTo)}`
            : dateFrom
              ? `From ${dayLabel(dateFrom)}`
              : `Until ${dayLabel(dateTo)}`,
      });
    }
    if (minPrice !== null || maxPrice !== null) {
      const money = (value: number) => formatMoney(value, 'NGN');
      chips.push({
        key: 'amount',
        label:
          minPrice !== null && maxPrice !== null
            ? `${money(minPrice)} to ${money(maxPrice)}`
            : minPrice !== null
              ? `From ${money(minPrice)}`
              : `Up to ${money(maxPrice as number)}`,
      });
    }
    if (state) chips.push({ key: 'destination', label: city ? `${city}, ${state}` : state });
    return chips;
  });
  protected readonly draftError = computed<string | null>(() => {
    const { dateFrom, dateTo, minPrice, maxPrice } = this.draft();
    if (dateFrom && dateTo && dateFrom > dateTo) return 'The start date is after the end date.';
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      return 'The minimum amount is above the maximum.';
    }
    return null;
  });

  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  // Seeded from ?q= so the top bar's search lands here with the term already applied.
  protected readonly query = signal(this.route.snapshot.queryParamMap.get('q') ?? '');
  protected readonly filter = signal<Filter>('all');
  private readonly all = signal<DeliverySummary[]>([]);

  protected readonly filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'ongoing', label: 'Shipping' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  protected readonly counts = computed<Record<Filter, number>>(() => {
    const deliveries = this.all();
    return {
      all: deliveries.length,
      ongoing: deliveries.filter((item) => ONGOING.includes(this.normalized(item.status))).length,
      delivered: deliveries.filter((item) => DONE.includes(this.normalized(item.status))).length,
      cancelled: deliveries.filter((item) => this.normalized(item.status).startsWith('cancel'))
        .length,
    };
  });

  protected readonly visible = computed(() => {
    const term = this.query().trim().toLowerCase();
    const filter = this.filter();
    return this.all()
      .filter((item) => {
        const status = this.normalized(item.status);
        const matchesTerm =
          !term ||
          item.title.toLowerCase().includes(term) ||
          item.trackingId.toLowerCase().includes(term) ||
          item.receiverName?.toLowerCase().includes(term) ||
          item.dropOff?.toLowerCase().includes(term);
        const matchesFilter =
          filter === 'all' ||
          (filter === 'ongoing' && ONGOING.includes(status)) ||
          (filter === 'delivered' && DONE.includes(status)) ||
          (filter === 'cancelled' && status.startsWith('cancel'));
        return matchesTerm && matchesFilter;
      })
      .sort((a, b) => {
        const aPriority = ACTIVE_PRIORITY[this.normalized(a.status)] ?? 20;
        const bPriority = ACTIVE_PRIORITY[this.normalized(b.status)] ?? 20;
        return aPriority - bPriority || this.time(b.createdAt) - this.time(a.createdAt);
      });
  });

  protected readonly page = signal(1);
  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.visible().length / PAGE_SIZE)),
  );
  protected readonly paginationItems = computed<Array<number | 'ellipsis'>>(() => {
    const total = this.pageCount();
    const current = Math.min(this.page(), total);
    if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
    if (current <= 3) return [1, 2, 3, 'ellipsis', total];
    if (current >= total - 2) return [1, 'ellipsis', total - 2, total - 1, total];
    return [1, 'ellipsis', current, 'ellipsis', total];
  });
  protected readonly paged = computed(() => {
    const page = Math.min(this.page(), this.pageCount());
    const start = (page - 1) * PAGE_SIZE;
    return this.visible().slice(start, start + PAGE_SIZE);
  });
  protected readonly resultStart = computed(() =>
    this.visible().length ? (Math.min(this.page(), this.pageCount()) - 1) * PAGE_SIZE + 1 : 0,
  );
  protected readonly resultEnd = computed(() =>
    Math.min(this.page() * PAGE_SIZE, this.visible().length),
  );

  protected selectFilter(filter: Filter): void {
    this.filter.set(filter);
    this.page.set(1);
  }

  protected toggleFilters(): void {
    if (this.filtersOpen()) {
      this.filtersOpen.set(false);
      return;
    }
    const applied = this.applied();
    this.draft.set({ ...applied });
    this.filtersOpen.set(true);
    void this.prepareLocations(applied.state);
  }

  protected closeFilters(): void {
    this.filtersOpen.set(false);
  }

  protected patchDraft(patch: Partial<ParcelFilters>): void {
    this.draft.update((draft) => ({ ...draft, ...patch }));
  }

  protected setAmount(field: 'minPrice' | 'maxPrice', raw: string): void {
    const value = raw.trim() === '' ? null : Number(raw);
    this.patchDraft({
      [field]: value !== null && Number.isFinite(value) && value >= 0 ? value : null,
    });
  }

  protected setDatePreset(key: (typeof DATE_PRESETS)[number]['key']): void {
    const today = new Date();
    const from =
      key === 'month'
        ? new Date(today.getFullYear(), today.getMonth(), 1)
        : new Date(today.getFullYear(), today.getMonth(), today.getDate() - (Number(key) - 1));
    this.patchDraft({ dateFrom: isoDay(from), dateTo: isoDay(today) });
  }

  protected setState(label: string): void {
    this.patchDraft({ state: label, city: '' });
    void this.loadCities(label);
  }

  protected applyFilters(): void {
    if (this.draftError()) return;
    this.applied.set({ ...this.draft() });
    this.filtersOpen.set(false);
    this.page.set(1);
    void this.load();
  }

  protected clearFilters(): void {
    const hadFilters = hasParcelFilters(this.applied());
    this.applied.set(EMPTY_PARCEL_FILTERS);
    this.draft.set(EMPTY_PARCEL_FILTERS);
    this.filtersOpen.set(false);
    this.page.set(1);
    if (hadFilters) void this.load();
  }

  protected removeChip(group: FilterGroup): void {
    const patch: Partial<ParcelFilters> =
      group === 'date'
        ? { dateFrom: '', dateTo: '' }
        : group === 'amount'
          ? { minPrice: null, maxPrice: null }
          : { state: '', city: '' };
    this.applied.update((applied) => ({ ...applied, ...patch }));
    this.page.set(1);
    void this.load();
  }

  protected clearEverything(): void {
    this.query.set('');
    this.filter.set('all');
    this.clearFilters();
  }

  @HostListener('document:pointerdown', ['$event'])
  protected onDocumentPointerDown(event: PointerEvent): void {
    if (!this.filtersOpen()) return;
    const target = event.target as Node;
    const host = this.host.nativeElement;
    const inside = ['.filter-panel', '.filter-trigger'].some((selector) =>
      host.querySelector(selector)?.contains(target),
    );
    if (!inside) this.filtersOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.filtersOpen.set(false);
  }

  /** Options load on first open; an already-applied state also needs its cities for the city select. */
  private async prepareLocations(appliedState: string): Promise<void> {
    await this.loadStates();
    if (appliedState) await this.loadCities(appliedState);
  }

  private async loadStates(): Promise<void> {
    if (this.states().length) return;
    try {
      this.states.set(await this.locations.states());
    } catch {
      this.states.set([]);
    }
  }

  private async loadCities(stateLabel: string): Promise<void> {
    const state = this.states().find((option) => option.label === stateLabel);
    if (!state) {
      this.cities.set([]);
      return;
    }
    this.loadingCities.set(true);
    try {
      this.cities.set(await this.locations.cities(state.id));
    } catch {
      this.cities.set([]);
    } finally {
      this.loadingCities.set(false);
    }
  }

  protected setPage(page: number): void {
    this.page.set(Math.min(Math.max(page, 1), this.pageCount()));
  }

  private normalized(status: string): string {
    return status
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
  }

  private time(value: string | null | undefined): number {
    if (!value) return 0;
    const date = new Date(value).getTime();
    return Number.isNaN(date) ? 0 : date;
  }

  constructor() {
    this.seo.update({
      title: `My Parcels | ${SITE_NAME}`,
      description: 'Every parcel you have sent with Fardelins.',
      path: '/app/deliveries',
      robots: 'noindex, nofollow',
    });
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      const filters = this.applied();
      this.all.set(
        hasParcelFilters(filters)
          ? await this.deliveries.search(filters)
          : await this.deliveries.list(),
      );
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
