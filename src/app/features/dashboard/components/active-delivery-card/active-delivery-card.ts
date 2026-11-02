import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarAltArrowLeftBoldDuotone,
  solarAltArrowRightBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { AuthService } from '@core/auth/auth.service';
import { GeocodingService } from '@core/services/geocoding.service';
import { RoutingService } from '@core/services/routing.service';
import { DeliveriesService } from '@features/deliveries/deliveries.service';
import { MapPoint, RouteMap } from '@shared/components/route-map/route-map';
import { StatusPill } from '@shared/components/status-pill/status-pill';
import { ActiveDeliveryCardData } from '../../dashboard.models';

interface RouteState {
  points: MapPoint[];
  line: [number, number][];
  marker: [number, number] | null;
  origin: string;
  destination: string;
  orderDate: string;
}
interface Selection {
  parcel: ActiveDeliveryCardData;
  route: RouteState;
}
const STATIONARY_STATUSES = new Set(['pending', 'assigned', 'office', 'at_office']);

function normalizedStatus(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}
const WARM_OFFSETS = [1, -1, 2];
const EMPTY_ROUTE: RouteState = {
  points: [],
  line: [],
  marker: null,
  origin: 'Address unavailable',
  destination: 'Address unavailable',
  orderDate: 'Date unavailable',
};

@Component({
  selector: 'app-active-delivery-card',
  imports: [RouterLink, NgIcon, RouteMap, StatusPill],
  viewProviders: [provideIcons({ solarAltArrowLeftBoldDuotone, solarAltArrowRightBoldDuotone })],
  templateUrl: './active-delivery-card.html',
  styleUrl: './active-delivery-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveDeliveryCard implements OnDestroy {
  readonly deliveries = input.required<ActiveDeliveryCardData[]>();
  private readonly geocoding = inject(GeocodingService);
  private readonly routing = inject(RoutingService);
  private readonly deliveriesApi = inject(DeliveriesService);
  private readonly auth = inject(AuthService);
  private readonly requestedIndex = signal(0);
  protected readonly navigationIndex = computed(() =>
    Math.min(this.requestedIndex(), Math.max(0, this.deliveries().length - 1)),
  );
  private readonly resolved = signal<Selection | null>(null);
  private readonly cache = new Map<string, Promise<Selection>>();
  private generation = 0;
  private destroyed = false;
  protected readonly overview = signal<[number, number]>([8.6753, 9.082]);
  protected readonly selected = computed(() => this.deliveries()[this.navigationIndex()] ?? null);
  protected readonly selectedIndex = this.navigationIndex;
  protected readonly loading = computed(() => {
    const parcel = this.selected();
    return !!parcel && this.resolved()?.parcel.trackingId !== parcel.trackingId;
  });
  protected readonly routeState = computed<RouteState>(() => {
    const parcel = this.selected();
    if (!parcel) return EMPTY_ROUTE;
    const resolved = this.resolved();
    if (resolved?.parcel.trackingId === parcel.trackingId) return resolved.route;
    return {
      ...EMPTY_ROUTE,
      origin: 'Finding address…',
      destination: parcel.destination,
      orderDate: parcel.orderDate || EMPTY_ROUTE.orderDate,
    };
  });
  // The map keeps the last resolved route (dimmed) while the next one loads.
  protected readonly mapState = computed(() =>
    this.selected() ? (this.resolved()?.route ?? EMPTY_ROUTE) : EMPTY_ROUTE,
  );

  constructor() {
    effect(() => {
      const parcels = this.deliveries();
      const index = this.navigationIndex();
      const parcel = parcels[index];
      const generation = ++this.generation;
      if (!parcel) {
        this.resolved.set(null);
        return;
      }
      void this.resolve(parcel).then((selection) => {
        if (this.destroyed || generation !== this.generation) return;
        this.resolved.set(selection);
        this.warm(parcels, index);
      });
    });
    effect(() => {
      const country = this.auth.user()?.country;
      this.overview.set([8.6753, 9.082]);
      if (country)
        void this.geocoding.locateCountry(country).then((point) => {
          if (!this.destroyed && this.auth.user()?.country === country && point)
            this.overview.set([point.lon, point.lat]);
        });
    });
  }

  protected previous(): void {
    this.requestedIndex.set(Math.max(this.navigationIndex() - 1, 0));
  }
  protected next(): void {
    this.requestedIndex.set(
      Math.max(0, Math.min(this.navigationIndex() + 1, this.deliveries().length - 1)),
    );
  }

  // Neighbours load together: the public geocoder handles a small burst as fast as a single call.
  private warm(parcels: ActiveDeliveryCardData[], index: number): void {
    for (const offset of WARM_OFFSETS) {
      const parcel = parcels[index + offset];
      if (parcel) void this.resolve(parcel);
    }
  }

  private resolve(parcel: ActiveDeliveryCardData): Promise<Selection> {
    const key = JSON.stringify(parcel);
    const cached = this.cache.get(key);
    if (cached) return cached;
    const pending = this.plot(parcel).catch(() => ({
      parcel,
      route: {
        ...EMPTY_ROUTE,
        destination: parcel.destination,
        orderDate: parcel.orderDate || EMPTY_ROUTE.orderDate,
      },
    }));
    this.cache.set(key, pending);
    return pending;
  }

  private async plot(parcel: ActiveDeliveryCardData): Promise<Selection> {
    const detail = await this.deliveriesApi.detail(parcel.trackingId).catch(() => null);
    const origin = detail?.pickupAddress || EMPTY_ROUTE.origin;
    const destination = detail?.dropOffAddress || parcel.destination;
    const orderDate = detail?.createdLabel || parcel.orderDate || EMPTY_ROUTE.orderDate;
    const [from, to] = await Promise.all([
      this.geocoding.locate(detail?.pickupAddress),
      this.geocoding.locate(destination),
    ]);
    const points: MapPoint[] = [];
    if (from) points.push({ ...from, label: origin, kind: 'pickup' });
    if (to) points.push({ ...to, label: destination, kind: 'dropoff' });
    const road = from && to ? await this.routing.route(from, to) : null;
    return {
      parcel,
      route: {
        points,
        line: road?.coordinates ?? [],
        marker:
          road && !STATIONARY_STATUSES.has(normalizedStatus(parcel.status))
            ? this.routing.pointAt(road, Math.min(Math.max(parcel.phaseIndex / 3, 0), 1))
            : null,
        origin,
        destination,
        orderDate,
      },
    };
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.generation++;
  }
}
