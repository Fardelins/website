import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { injectLogisticsApiUrl } from '@core/services/logistics-api.config';
import {
  TRACKING_PHASES,
  TrackingEvent,
  TrackingEventRaw,
  phaseIndexForStatus,
  statusLabel,
} from '@features/tracking/tracking.model';
import { MOCK_DELIVERIES, filterMockDeliveries, mockDeliveryDetail } from './deliveries.mock';
import {
  DeliveryDetail,
  DeliverySummary,
  ParcelFilters,
  asBag,
  formatDate,
  formatMoney,
  hasNextPage,
  matchesLocation,
  parcelFilterParams,
  readList,
  readString,
} from './deliveries.model';

const SHIPMENT_PAGE_SIZE = 20;
const MAX_SHIPMENT_PAGES = 25;

@Injectable({ providedIn: 'root' })
export class DeliveriesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = injectLogisticsApiUrl();
  private readonly auth = inject(AuthService);
  private listCache: {
    ownerId: string | null;
    request: Promise<DeliverySummary[]>;
  } | null = null;

  /**
   * Shared across the dashboard and the shell's notification bell, so opening the app
   * fetches the list once instead of per consumer. Pass `force` after a mutation.
   */
  async list(force = false): Promise<DeliverySummary[]> {
    const ownerId = this.auth.user()?.id ?? null;
    if (!force && this.listCache?.ownerId === ownerId) return this.listCache.request;

    const request = this.fetchList();
    this.listCache = { ownerId, request };
    try {
      return await request;
    } catch (error) {
      // An older account request may finish after a new login has already replaced it.
      // Never let that stale completion erase the new account's cache.
      if (this.listCache?.request === request) this.listCache = null;
      throw error;
    }
  }

  private async fetchList(): Promise<DeliverySummary[]> {
    if (this.auth.isMockSession()) return MOCK_DELIVERIES;
    return (await this.fetchShipmentRows({})).map((item) => this.toSummary(item));
  }

  /**
   * The endpoint pages its results and returns only the first page when asked without params, so
   * an account with more parcels than BE's default page would silently lose the rest. Follows the
   * paging fields up to 500 rows (25 pages of the 20 that BE's own collection uses).
   */
  private async fetchShipmentRows(params: Record<string, string>): Promise<unknown[]> {
    const rows: unknown[] = [];
    for (let page = 1; page <= MAX_SHIPMENT_PAGES; page++) {
      const body = await firstValueFrom(
        this.http.get(this.apiUrl('/customer-shipment/shipments'), {
          params: { ...params, page: String(page), limit: String(SHIPMENT_PAGE_SIZE) },
        }),
      );
      rows.push(...readList(body));
      if (!hasNextPage(body)) break;
    }
    return rows;
  }

  /** Server-side filtered list. Uncached: the shared `list()` stays the unfiltered source. */
  async search(filters: ParcelFilters): Promise<DeliverySummary[]> {
    if (this.auth.isMockSession()) return filterMockDeliveries(MOCK_DELIVERIES, filters);
    const rows = await this.fetchShipmentRows(parcelFilterParams(filters));
    return rows
      .map((item) => this.toSummary(item))
      .filter((item) => matchesLocation(item, filters));
  }

  async detail(trackingId: string): Promise<DeliveryDetail | null> {
    if (this.auth.isMockSession()) return mockDeliveryDetail(trackingId);
    const record = await this.findOwnShipment(trackingId);
    if (!record) return null;

    const events = this.toEvents(record);
    return {
      ...this.toSummary(record),
      senderName: readString(record['sender'] ?? record, [
        'sender_fullname',
        'fullname',
        'name',
        'sender_name',
      ]),
      receiverName: readString(record['receiver'] ?? record, [
        'receiver_fullname',
        'fullname',
        'name',
        'receiver_name',
      ]),
      pickupAddress: readString(record['pickup'] ?? record['sender_location'] ?? record, [
        'sender_address',
        'pickup_address',
        'origin',
        'address',
      ]),
      dropOffAddress: readString(record['receiver_location'] ?? record['destination'] ?? record, [
        'address',
        'receiver_address',
        'dropoff_address',
        'destination',
      ]),
      courierName: readString(
        record['courier'] ??
          record['account'] ??
          asBag(record['hub'])['courier_business'] ??
          record,
        ['business_name', 'company_name', 'name', 'courier_name'],
      ),
      pickupCoords: this.coords(record['sender_location']),
      dropOffCoords: this.coords(record['receiver_location']),
      ...this.packageFacts(record),
      distanceLabel: this.distanceLabel(record),
      weightLabel: this.weightLabel(record),
      boxTypeLabel: readString(this.firstParcel(record), [
        'size',
        'size_label',
        'box_type',
        'package_size',
        'category',
        'category_name',
      ]),
      paid:
        asBag(record['order'])['status'] === 'paid' ||
        Boolean(record['is_paid'] ?? record['paid'] ?? record['payment_status'] === 'paid'),
      events,
      // The row's own status can be ahead of its tracking events (or the events can be empty).
      currentPhaseIndex: events.reduce(
        (max, event) => Math.max(max, event.phaseIndex),
        phaseIndexForStatus(
          (readString(record, ['status']) ?? '')
            .trim()
            .toLowerCase()
            .replace(/[\s-]+/g, '_'),
        ),
      ),
    };
  }

  /**
   * GET /shipment/{trackingId} is courier-only (403 for a customer token), but each row of the
   * customer's own list already carries the full shipment: locations, parcels, hub, order, tracking.
   */
  private async findOwnShipment(trackingId: string): Promise<Record<string, unknown> | null> {
    const matches = (row: unknown) => readString(row, ['tracking_id', 'trackingId']) === trackingId;
    // The tracking_id filter only takes a shipment UUID, so search is used for the FDL- code.
    try {
      const found = (await this.fetchShipmentRows({ search: trackingId })).find(matches);
      if (found) return asBag(found);
    } catch {
      // Fall through to scanning the whole list.
    }
    const scanned = (await this.fetchShipmentRows({})).find(matches);
    return scanned ? asBag(scanned) : null;
  }

  private toSummary(source: unknown): DeliverySummary {
    const record = asBag(source);
    const parcel = this.firstParcel(record);
    const order = asBag(record['order']);
    const trackingId =
      readString(record, ['tracking_id', 'trackingId', 'tracking_number', 'id']) ?? '';

    const createdAt = readString(record, ['created_at', 'createdAt', 'order_date']);
    const etaAt = readString(record, ['estimated_delivery', 'delivery_date']);
    const rawAmount =
      record['amount'] ?? record['total'] ?? record['price'] ?? record['cost'] ?? order['amount'];
    const parsedAmount = typeof rawAmount === 'string' ? Number(rawAmount) : rawAmount;
    const business = asBag(asBag(record['hub'])['courier_business']);
    const currency = readString(record['currency'] ?? business['currency'] ?? record, [
      'code',
      'currency_code',
      'currency',
    ]);
    return {
      trackingId,
      shipmentId: readString(record, ['id']),
      orderId: readString(order, ['id']),
      title:
        readString(parcel, ['short_description', 'name', 'description']) ??
        readString(record, ['short_description', 'description', 'title']) ??
        'Parcel',
      status: this.statusOf(record, order),
      imageUrl: this.firstImage(parcel, record),
      createdLabel: formatDate(createdAt),
      dropOff: readString(asBag(record['receiver_location'] ?? record['destination']), [
        'address',
        'city',
        'state',
      ]),
      dropOffState: readString(asBag(asBag(record['receiver_location'])['state']), ['name']),
      dropOffCity: readString(asBag(asBag(record['receiver_location'])['city']), ['name']),
      etaLabel: formatDate(etaAt) || null,
      amountLabel: formatMoney(rawAmount, currency ?? undefined),
      createdAt,
      etaAt,
      amount:
        typeof parsedAmount === 'number' && Number.isFinite(parsedAmount) ? parsedAmount : null,
      currency,
      receiverName: readString(record['receiver'] ?? record, [
        'receiver_fullname',
        'fullname',
        'name',
        'receiver_name',
      ]),
    };
  }

  private firstImage(...sources: unknown[]): string | null {
    for (const source of sources) {
      const bag = asBag(source);
      for (const key of ['images', 'uploads', 'photos', 'media']) {
        const list = bag[key];
        if (Array.isArray(list) && list.length) {
          const first = list[0];
          const url =
            typeof first === 'string' ? first : readString(first, ['url', 'link', 'path', 'src']);
          if (url) return url;
        }
      }
      const single = readString(bag, ['image', 'image_url', 'thumbnail']);
      if (single) return single;
    }
    return null;
  }

  /**
   * Cancels a shipment that has not been paid for. BE can apply the change and still answer 400,
   * and answers 409 when it is already cancelled, so the list is checked before reporting failure.
   */
  async cancel(shipmentId: string): Promise<void> {
    if (this.auth.isMockSession()) return;
    try {
      await firstValueFrom(
        this.http.patch(this.apiUrl(`/user/shipment/${encodeURIComponent(shipmentId)}`), {
          status: 'canceled',
        }),
      );
    } catch (error) {
      const already = error instanceof HttpErrorResponse && error.status === 409;
      if (!already && !(await this.isCanceled(shipmentId))) {
        throw new Error("We couldn't cancel this shipment. Please try again.");
      }
    }
    await this.list(true).catch(() => undefined);
  }

  private async isCanceled(shipmentId: string): Promise<boolean> {
    try {
      const row = (await this.fetchShipmentRows({})).find(
        (item) => readString(item, ['id']) === shipmentId,
      );
      return /^cancel/i.test(readString(row, ['status']) ?? '');
    } catch {
      return false;
    }
  }

  /** Everything on the row the detail page shows beyond the summary: photos, package, contacts. */
  private packageFacts(record: Record<string, unknown>): Partial<DeliveryDetail> {
    const parcel = this.firstParcel(record);
    const business = asBag(asBag(record['hub'])['courier_business']);
    const dimension = asBag(parcel['dimension']);
    const sizes = ['length', 'width', 'height'].map((key) => Number(dimension[key]));
    const worth = Number(parcel['worth'] ?? record['total_worth']);
    const type = readString(parcel, ['type']);
    const delivery = readString(record, ['delivery_type']);
    const currency = readString(asBag(business['currency']), ['code']);
    return {
      images: readList(parcel['media'])
        .map((item) => readString(item, ['link', 'url']))
        .filter((link): link is string => Boolean(link)),
      description: readString(parcel, ['long_description']),
      categoryLabel: readString(asBag(parcel['category']), ['name']),
      parcelTypeLabel:
        type === 'perishable' ? 'Perishable' : type === 'non_perishable' ? 'Non-perishable' : null,
      dimensionsLabel: sizes.every((value) => Number.isFinite(value) && value > 0)
        ? `${sizes.join(' × ')} cm`
        : null,
      quantity: Number.isFinite(Number(parcel['quantity'])) ? Number(parcel['quantity']) : null,
      worthLabel:
        Number.isFinite(worth) && worth > 0 ? formatMoney(worth, currency ?? undefined) : null,
      deliveryTypeLabel:
        delivery === 'user' ? 'Your doorstep' : delivery === 'office' ? 'Courier office' : null,
      updatedLabel: formatDate(readString(record, ['updated_at'])) || null,
      senderPhone: readString(record, ['sender_phone']),
      senderEmail: readString(record, ['sender_email']),
      receiverPhone: readString(record, ['receiver_phone']),
      receiverEmail: readString(record, ['receiver_email']),
      courierContact:
        [readString(business, ['helpline']), readString(business, ['contact_email'])]
          .filter(Boolean)
          .join(' · ') || null,
    };
  }

  /** A shipment is "pending" for both a parcel nobody has paid for yet and one waiting for pickup. */
  private statusOf(record: Record<string, unknown>, order: Record<string, unknown>): string {
    const status = readString(record, ['status', 'shipment_status', 'current_status']) ?? 'pending';
    const payment = readString(order, ['status']);
    return status === 'pending' && payment && payment !== 'paid' ? 'awaiting_payment' : status;
  }

  /** BE geocodes both addresses, which is more reliable than guessing from the address text alone. */
  private coords(location: unknown): { lat: number; lon: number } | null {
    const bag = asBag(location);
    const lat = Number(bag['latitude']);
    const lon = Number(bag['longitude']);
    return bag['latitude'] != null &&
      bag['longitude'] != null &&
      Number.isFinite(lat) &&
      Number.isFinite(lon)
      ? { lat, lon }
      : null;
  }

  private distanceLabel(record: Record<string, unknown>): string | null {
    const distance = record['distance'] ?? record['distance_km'];
    const value = typeof distance === 'string' ? Number(distance) : distance;
    return typeof value === 'number' && Number.isFinite(value) ? `${value} km` : null;
  }

  /** Rows carry a `parcels` array; older guesses had a single `parcel`/`package` object. */
  private firstParcel(record: Record<string, unknown>): Record<string, unknown> {
    return asBag(record['parcel'] ?? record['package'] ?? readList(record['parcels'])[0]);
  }

  private weightLabel(record: Record<string, unknown>): string | null {
    const parcel = this.firstParcel(record);
    const weight = record['total_weight'] ?? parcel['weight'] ?? record['weight'];
    const value = typeof weight === 'string' ? Number(weight) : weight;
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? `${value}kg` : null;
  }

  // `order` is non-contiguous, so sort by it (not array position), newest first like TrackingResult.events.
  private toEvents(record: Record<string, unknown>): TrackingEvent[] {
    const raw = readList(record['tracking'] ?? record['timeline'] ?? record['events'] ?? []);
    return (raw as TrackingEventRaw[])
      .filter((event) => typeof event?.status === 'string')
      .sort((a, b) => (b.order ?? 0) - (a.order ?? 0))
      .map((event) => {
        const date = new Date(event.created_at);
        const valid = !Number.isNaN(date.getTime());
        return {
          id: String(event.id ?? event.order ?? event.status),
          description: event.description ?? '',
          status: event.status,
          statusLabel: statusLabel(event.status),
          location: event.location ?? null,
          order: event.order ?? 0,
          dateLabel: valid ? formatDate(event.created_at) : '',
          timeLabel: valid
            ? date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })
            : '',
          phaseIndex: phaseIndexForStatus(event.status),
        };
      });
  }

  readonly phases = TRACKING_PHASES;
}
