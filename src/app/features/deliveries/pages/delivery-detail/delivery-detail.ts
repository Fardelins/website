import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarAltArrowDownBoldDuotone,
  solarCheckCircleBoldDuotone,
  solarClockCircleBoldDuotone,
  solarDangerCircleBoldDuotone,
  solarDeliveryBoldDuotone,
  solarDownloadMinimalisticBoldDuotone,
  solarBanknoteBoldDuotone,
  solarMapPointBoldDuotone,
  solarRefreshBoldDuotone,
  solarRefreshCircleBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { AuthService } from '@core/auth/auth.service';
import { GeocodingService } from '@core/services/geocoding.service';
import { HapticsService } from '@core/services/haptics.service';
import { ToastService } from '@core/services/toast.service';
import { RoutingService } from '@core/services/routing.service';
import { PaymentService } from '@features/payment/payment.service';
import { ProfileService, Transaction } from '@features/profile/profile.service';
import { SITE_NAME, SeoService } from '@core/services/seo.service';
import { EmptyState } from '@shared/components/empty-state/empty-state';
import { ImageCarousel } from '@shared/components/image-carousel/image-carousel';
import { ReceiptDialog } from '@shared/components/receipt-dialog/receipt-dialog';
import { MapPoint, RouteMap } from '@shared/components/route-map/route-map';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { TrackingCopy } from '@shared/components/tracking-copy/tracking-copy';
import { TrackingPhase, phaseLabel, statusLabel } from '@features/tracking/tracking.model';
import { parcelStatusGroup } from '@shared/parcel-status';
import { DeliveryRatingCard } from '../../components/delivery-rating/delivery-rating';
import { DeliveriesService } from '../../deliveries.service';
import { DeliveryDetail as Detail } from '../../deliveries.model';

// A shipment can be cancelled until it is picked up, paid or not. The refund promise in the dialog
// relies on BE refunding paid cancellations, which it does not do yet.
const CANCELLABLE = ['pending', 'awaiting_payment', 'assigned'];

@Component({
  selector: 'app-delivery-detail',
  imports: [
    RouterLink,
    NgIcon,
    EmptyState,
    Skeleton,
    RouteMap,
    TrackingCopy,
    ImageCarousel,
    DeliveryRatingCard,
    ReceiptDialog,
  ],
  viewProviders: [
    provideIcons({
      solarAltArrowDownBoldDuotone,
      solarCheckCircleBoldDuotone,
      solarDownloadMinimalisticBoldDuotone,
      solarDangerCircleBoldDuotone,
      solarClockCircleBoldDuotone,
      solarDeliveryBoldDuotone,
      solarBanknoteBoldDuotone,
      solarMapPointBoldDuotone,
      solarRefreshBoldDuotone,
      solarRefreshCircleBoldDuotone,
    }),
  ],
  templateUrl: './delivery-detail.html',
  styleUrls: ['../../../../shared/styles/forms.css', './delivery-detail.css'],
})
export class DeliveryDetail implements OnDestroy {
  private readonly deliveries = inject(DeliveriesService);
  private readonly route = inject(ActivatedRoute);
  private readonly haptics = inject(HapticsService);
  private readonly toast = inject(ToastService);
  private readonly seo = inject(SeoService);
  private readonly geocoding = inject(GeocodingService);
  private readonly routing = inject(RoutingService);
  private readonly auth = inject(AuthService);
  private readonly payments = inject(PaymentService);
  private readonly profile = inject(ProfileService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private generation = 0;
  private paymentRequestedFor = '';

  /** The completed payment for this parcel; the Payment section only exists once it is found. */
  protected readonly payment = signal<Transaction | null>(null);
  protected readonly receiptOpen = signal(false);

  protected readonly busy = signal<'pay' | 'cancel' | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly cancelError = signal<string | null>(null);
  protected readonly agreed = signal(false);
  private readonly cancelDialog = viewChild<ElementRef<HTMLDialogElement>>('cancelDialog');

  private readonly statusKey = computed(() =>
    (this.detail()?.status ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_'),
  );
  protected readonly awaitingPayment = computed(() => this.statusKey() === 'awaiting_payment');
  protected readonly isCancelled = computed(() => this.statusKey().startsWith('cancel'));
  /** Raw `delivered` means out for delivery; only a handed-over parcel can be rated. */
  protected readonly handedOver = computed(
    () => parcelStatusGroup(this.detail()?.status ?? '') === 'delivered',
  );
  protected readonly canCancel = computed(() => CANCELLABLE.includes(this.statusKey()));
  /** An unpaid or cancelled shipment has no tracking to refresh. */
  protected readonly showRefresh = computed(
    () => !this.detail() || !(this.awaitingPayment() || this.isCancelled()),
  );
  protected readonly showStatusCard = computed(() => !this.awaitingPayment());
  protected readonly showStepper = computed(
    () => !this.isCancelled() || (this.detail()?.events.length ?? 0) > 0,
  );
  protected readonly showTimeline = computed(() => (this.detail()?.events.length ?? 0) > 0);
  /** Paid shipments must tick the refund box before cancelling; unpaid ones have nothing to refund. */
  protected readonly canConfirmCancel = computed(() => !this.detail()?.paid || this.agreed());
  protected readonly photos = computed(() => {
    const item = this.detail();
    if (!item) return [];
    if (item.images?.length) return item.images;
    return item.imageUrl ? [item.imageUrl] : [];
  });

  protected readonly loading = signal(true);
  protected readonly refreshing = signal(false);
  protected readonly failed = signal(false);
  // Collapsed by default on phones so the page opens on the map and status; desktop has room to show it open.
  protected readonly timelineOpen = signal(
    !(this.isBrowser && matchMedia('(max-width: 900px)').matches),
  );
  protected readonly detail = signal<Detail | null>(null);
  protected readonly trackingId = signal('');
  protected readonly phases = this.deliveries.phases;
  protected readonly mapPoints = signal<MapPoint[]>([]);
  protected readonly routeLine = signal<[number, number][]>([]);
  protected readonly riderMarker = signal<[number, number] | null>(null);
  protected readonly routeKm = signal<number | null>(null);
  protected readonly distanceLabel = computed(() => {
    const km = this.routeKm();
    return this.detail()?.distanceLabel ?? (km ? `${Math.round(km)} km` : null);
  });
  protected readonly overview = signal<[number, number]>([8.6753, 9.082]);
  protected readonly currentPhase = computed(() => this.detail()?.currentPhaseIndex ?? -1);
  protected readonly currentStatusLabel = computed(() =>
    this.detail() ? statusLabel(this.detail()!.status) : '',
  );
  protected readonly parcelMeta = computed(() => {
    const item = this.detail();
    return item ? [item.weightLabel, item.boxTypeLabel].filter(Boolean).join(' · ') : '';
  });
  protected readonly packageFacts = computed(() => {
    const item = this.detail();
    if (!item) return [];
    const facts: { label: string; value: string }[] = [];
    const add = (label: string, value: string | number | null | undefined) => {
      if (value !== null && value !== undefined && value !== '')
        facts.push({ label, value: String(value) });
    };
    add('Category', item.categoryLabel);
    add('Type', item.parcelTypeLabel);
    add('Quantity', item.quantity);
    add('Dimensions', item.dimensionsLabel);
    add('Declared value', item.worthLabel);
    return facts;
  });
  private readonly lastUpdatedAt = signal<Date | null>(null);
  /** The line next to the status: when it was last refreshed, or when it was cancelled. */
  protected readonly statusMeta = computed(() => {
    if (this.isCancelled()) {
      const when = this.detail()?.updatedLabel;
      return when ? `Cancelled on ${when}` : '';
    }
    return this.lastUpdatedLabel();
  });
  // Nothing else re-triggers this computed between fetches, so a tick keeps "5 mins ago" from freezing.
  private readonly clock = signal(0);
  private clockTimer?: ReturnType<typeof setInterval>;
  protected readonly lastUpdatedLabel = computed(() => {
    this.clock();
    const at = this.lastUpdatedAt();
    if (!at) return '';
    const minutes = Math.floor((Date.now() - at.getTime()) / 60_000);
    if (minutes < 1) return 'Last updated just now';
    if (minutes < 60) return `Last updated ${minutes} min${minutes === 1 ? '' : 's'} ago`;
    const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `Last updated today at ${time}`;
  });

  constructor() {
    this.trackingId.set(this.route.snapshot.paramMap.get('trackingId') ?? '');
    this.seo.update({
      title: `Delivery ${this.trackingId()} | ${SITE_NAME}`,
      description: 'Track this delivery end to end.',
      path: `/app/deliveries/${this.trackingId()}`,
      robots: 'noindex, nofollow',
    });
    const country = this.auth.user()?.country;
    if (country)
      void this.geocoding.locateCountry(country).then((point) => {
        if (point) this.overview.set([point.lon, point.lat]);
      });
    void this.load();
    this.clockTimer = setInterval(() => this.clock.update((n) => n + 1), 30_000);
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      await this.fetchDetail();
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  // A header refresh keeps the page mounted (no skeleton), a failed poll keeps the last good state, and a fast response still spins briefly so the click reads as acted on.
  protected async refresh(): Promise<void> {
    this.haptics.light();
    this.refreshing.set(true);
    const minSpin = new Promise((resolve) => setTimeout(resolve, 650));
    try {
      await Promise.all([this.fetchDetail(), minSpin]);
    } catch {
      // Keep the last good state on screen rather than an error empty-state.
      this.toast.error("Couldn't refresh this parcel", {
        description: 'Showing the last update we received.',
        actions: [{ label: 'Try again', run: () => void this.refresh() }],
      });
    } finally {
      this.refreshing.set(false);
    }
  }

  protected async completePayment(): Promise<void> {
    const orderId = this.detail()?.orderId;
    if (!orderId || this.busy()) return;
    this.haptics.light();
    this.busy.set('pay');
    this.actionError.set(null);
    try {
      const url = await this.payments.resume(orderId);
      // Off-site Paystack page, so a full navigation like the order flow, not a router one.
      globalThis.location.href = url;
    } catch (error) {
      this.actionError.set((error as Error).message);
      this.haptics.error();
      this.busy.set(null);
    }
  }

  protected askCancel(): void {
    this.haptics.light();
    this.cancelError.set(null);
    this.agreed.set(false);
    this.cancelDialog()?.nativeElement.showModal();
  }

  protected closeCancel(): void {
    this.cancelDialog()?.nativeElement.close();
  }

  /** The dialog fills the viewport, so a click on its own surface (outside the card) is the backdrop. */
  protected onCancelBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.busy()) this.closeCancel();
  }

  protected async cancelShipment(): Promise<void> {
    const shipmentId = this.detail()?.shipmentId;
    if (!shipmentId || this.busy() || !this.canConfirmCancel()) return;
    this.busy.set('cancel');
    this.cancelError.set(null);
    try {
      await this.deliveries.cancel(shipmentId);
      this.haptics.success();
      this.closeCancel();
      this.toast.success('Shipment cancelled', { description: this.trackingId() });
      await this.fetchDetail();
    } catch (error) {
      this.cancelError.set((error as Error).message);
      this.haptics.error();
    } finally {
      this.busy.set(null);
    }
  }

  private async fetchDetail(): Promise<void> {
    const generation = ++this.generation;
    const detail = await this.deliveries.detail(this.trackingId());
    if (generation !== this.generation) return;
    this.detail.set(detail);
    this.lastUpdatedAt.set(new Date());
    if (detail?.paid) void this.loadPayment(detail.trackingId);
    if (detail) await this.plot(detail, generation);
  }

  private async loadPayment(trackingId: string): Promise<void> {
    if (this.paymentRequestedFor === trackingId) return;
    this.paymentRequestedFor = trackingId;
    try {
      this.payment.set(await this.profile.paymentFor(trackingId));
    } catch {
      // Not worth an error banner; the next refresh asks again.
      this.paymentRequestedFor = '';
    }
  }

  protected openReceipt(): void {
    this.haptics.selection();
    this.receiptOpen.set(true);
  }

  /** Every payment goes through Paystack; the channel (card, bank transfer) is added when BE says. */
  protected methodLabel(payment: Transaction): string {
    const channel = payment.channel?.replace(/[_-]+/g, ' ').toLowerCase();
    return channel ? `Paystack · ${channel.replace(/^\w/, (c) => c.toUpperCase())}` : 'Paystack';
  }

  protected phaseDone(index: number): boolean {
    // A dispatcher being assigned (`assigned`) completes the first step; `pending` is still confirming.
    const accepted = index === 0 && this.statusKey() === 'assigned';
    return (
      accepted || index < this.currentPhase() || this.currentPhase() === this.phases.length - 1
    );
  }

  protected phaseCurrent(index: number): boolean {
    return index === this.currentPhase() && !this.phaseDone(index);
  }

  protected stepLabel(phase: TrackingPhase): string {
    return phaseLabel(phase, this.statusKey());
  }

  private async plot(item: Detail, generation: number): Promise<void> {
    // BE's own coordinates win: geocoding the address text alone put an Abuja drop-off in Lagos.
    const [from, to] = await Promise.all([
      item.pickupCoords
        ? { ...item.pickupCoords, matched: '', approximate: false }
        : this.geocoding.locate(item.pickupAddress),
      item.dropOffCoords
        ? { ...item.dropOffCoords, matched: '', approximate: false }
        : this.geocoding.locate(item.dropOffAddress ?? item.dropOff),
    ]);
    if (generation !== this.generation) return;
    const points: MapPoint[] = [];
    if (from)
      points.push({ ...from, kind: 'pickup', label: item.pickupAddress || 'Pickup location' });
    if (to)
      points.push({
        ...to,
        kind: 'dropoff',
        label: item.dropOffAddress || item.dropOff || 'Drop-off location',
      });
    this.mapPoints.set(points);
    const road = from && to ? await this.routing.route(from, to) : null;
    if (generation !== this.generation || !road) return;
    this.routeLine.set(road.coordinates);
    this.routeKm.set(road.distanceKm);
    const stationary = new Set([
      'pending',
      'assigned',
      'office',
      'at_office',
      'cancelled',
      'canceled',
      'failed',
    ]);
    const status = item.status
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    if (!stationary.has(status)) {
      const progress = Math.min(Math.max(item.currentPhaseIndex / (this.phases.length - 1), 0), 1);
      this.riderMarker.set(this.routing.pointAt(road, progress));
    }
  }

  ngOnDestroy(): void {
    this.generation++;
    clearInterval(this.clockTimer);
  }
}
