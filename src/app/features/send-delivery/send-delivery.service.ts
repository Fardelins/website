import { HttpClient } from '@angular/common/http';
import { Injectable, inject, isDevMode } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { injectLogisticsApiUrl } from '@core/services/logistics-api.config';
import { parseApiError } from '@core/auth/auth.models';
import { compressImage } from '@shared/utils/compress-image';
import { MOCK_COURIERS } from '../../dev/mock-couriers';
import {
  asBag,
  formatMoney,
  readList,
  readRecord,
  readString,
} from '@features/deliveries/deliveries.model';
import {
  CourierRate,
  DeliveryOptions,
  LocationIds,
  Option,
  OrderResult,
  ParcelImage,
  SendDraft,
  toInternationalPhone,
} from './send-delivery.model';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

@Injectable({ providedIn: 'root' })
export class SendDeliveryService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly apiUrl = injectLogisticsApiUrl();

  categories(): Promise<Option[]> {
    return this.options('/category/parcel-categories');
  }

  sizes(): Promise<Option[]> {
    return this.options('/shipment-sizes');
  }

  async countries(): Promise<Option[]> {
    return this.options('/locality/countries');
  }

  /** States belong to a country by locality id, not name: resolve Nigeria's id first. */
  async states(countryName = 'Nigeria'): Promise<Option[]> {
    const countries = await this.countries();
    const country = countries.find((c) => c.label.toLowerCase() === countryName.toLowerCase());
    if (!country) return [];
    return this.sortedByLabel(this.options(`/locality?parent_id=${country.id}&is_state=true`));
  }

  cities(stateId: number): Promise<Option[]> {
    return this.sortedByLabel(this.options(`/locality?parent_id=${stateId}&is_city=true`));
  }

  private async sortedByLabel(options: Promise<Option[]>): Promise<Option[]> {
    return (await options).sort((a, b) => a.label.localeCompare(b.label));
  }

  async rates(draft: SendDraft): Promise<CourierRate[]> {
    if (this.auth.isMockSession()) {
      return MOCK_COURIERS.map((courier) => ({
        rateId: courier.rateId,
        courierName: courier.name,
        logoUrl: courier.logoUrl,
        amount: courier.amount,
        priceLabel: formatMoney(courier.amount, 'NGN') ?? `₦${courier.amount.toLocaleString()}`,
        deliveryWindow: courier.deliveryWindow,
        rating: courier.rating,
        reviewCount: courier.reviewCount,
      }));
    }

    const body = await firstValueFrom(
      this.http.post(this.apiUrl('/public/get-shipment-rates'), {
        shipment_size_id: draft.parcel.sizeId,
        origin_locality: {
          country: draft.pickup.country,
          state: draft.pickup.state,
          city: draft.pickup.city || undefined,
        },
        dest_locality: {
          country: draft.dropoff.country,
          state: draft.dropoff.state,
          city: draft.dropoff.city || undefined,
        },
      }),
    );
    return readList(body)
      .map((item) => this.toRate(item, draft.parcel.sizeId, draft))
      .filter((rate): rate is CourierRate => rate !== null);
  }

  /**
   * Order creation doesn't return an id, it returns Paystack's payment init: an
   * `authorization_url` to redirect to, plus a `reference` to reconcile later. There is
   * deliberately no id here for the caller to route to a "your delivery is booked" screen with.
   */
  async order(
    draft: SendDraft,
    locations: Record<'pickup' | 'dropoff', LocationIds>,
  ): Promise<OrderResult> {
    if (this.auth.isMockSession()) {
      return {
        reference: `FD-DEMO-${Date.now().toString().slice(-8)}`,
        authorizationUrl: null,
      };
    }

    try {
      const body = await firstValueFrom(
        this.http.post(this.apiUrl(`/customer-shipment/order/${draft.rateId}`), {
          // Optional in the spec, but the only place the typed pickup address travels: omitting it
          // makes BE use the account's stored address instead. All six fields are required when sent.
          sender_details: {
            sender_fullname: draft.pickup.fullName.trim(),
            sender_phone: toInternationalPhone(draft.pickup.phone),
            sender_email: draft.pickup.email.trim() || undefined,
            sender_address: draft.pickup.address.trim(),
            sender_state_id: locations.pickup.stateId ?? undefined,
            sender_city_id: locations.pickup.cityId ?? undefined,
          },
          receiver_details: {
            receiver_fullname: draft.dropoff.fullName.trim(),
            receiver_phone: toInternationalPhone(draft.dropoff.phone),
            receiver_email: draft.dropoff.email.trim() || undefined,
            receiver_location: {
              address: draft.dropoff.address.trim(),
              state_id: locations.dropoff.stateId ?? undefined,
              city_id: locations.dropoff.cityId ?? undefined,
            },
          },
          parcel: {
            categoryId: draft.parcel.categoryId ?? undefined,
            type: draft.parcel.type ?? undefined,
            short_description: draft.parcel.shortDescription.trim(),
            weight: draft.parcel.weight ?? 1,
            quantity: draft.parcel.quantity,
            worth: draft.parcel.worth ?? undefined,
            // BE rejects an image that carries both its upload id and its link.
            images: draft.parcel.images.map(({ id }) => ({ id })),
          },
          shipment_size_id: draft.parcel.sizeId ?? undefined,
          pickup_type: 'user',
          delivery_type: draft.deliveryType,
          priority: draft.priority,
          // Confirmed enum is API | Manual | Mobile; BE only told us Mobile is for the mobile
          // app. Using Manual as the closer fit for a person filling out a web form, not yet
          // confirmed with BE (docs/customer-app-plan.md 2.8).
          source: 'Manual',
          // BE only uses mode as a label ([TEST] in the email subject), so dev builds mark theirs.
          mode: isDevMode() ? 'demo' : 'live',
        }),
      );
      const record = readRecord(body);
      return {
        reference: readString(record, ['reference', 'ref']),
        authorizationUrl: readString(record, ['authorization_url', 'authorizationUrl']),
      };
    } catch (error) {
      throw new Error(parseApiError(error, "We couldn't place that order. Please try again."));
    }
  }

  async uploadImages(files: FileList | File[]): Promise<ParcelImage[]> {
    const prepared = await Promise.all(Array.from(files).map(compressImage));
    if (prepared.some((file) => file.size > MAX_IMAGE_BYTES)) {
      throw new Error('One of those photos is too large. Please pick one under 10 MB.');
    }
    const form = new FormData();
    prepared.forEach((file) => form.append('images', file, file.name));

    let body: unknown;
    try {
      body = await firstValueFrom(
        this.http.post(this.apiUrl('/upload/multiple-images/shipments'), form),
      );
    } catch (error) {
      throw new Error(parseApiError(error, "We couldn't upload those images. Please try again."));
    }
    const images = readList(body)
      .map((item) => ({
        id: readString(item, ['id', '_id']) ?? '',
        link: readString(item, ['link', 'url', 'path']) ?? '',
      }))
      .filter((image) => image.id && image.link);
    if (!images.length) throw new Error("We couldn't upload those images. Please try again.");
    return images;
  }

  private toRate(
    source: unknown,
    sizeId: number | null,
    options: DeliveryOptions,
  ): CourierRate | null {
    const record = asBag(source);
    // Confirmed shape: the courier sits under hub.courier_business; company_name and uploads
    // (an array, can be empty with no logo) live there. Older guesses kept as a fallback.
    const hub = asBag(record['hub']);
    const courier = asBag(
      hub['courier_business'] ?? record['account'] ?? record['courier'] ?? record['business'],
    );
    // Newer shape: one entry per box size, each carrying its own totals. The older flat shape has none.
    const sizes = readList(record['sizes']).map(asBag);
    const size = sizes.find((s) => Number(s['shipment_size_id']) === sizeId) ?? sizes[0] ?? null;
    if (size && size['available'] === false) return null;
    const amount = this.rateAmount(record, size, options);
    if (amount === null) return null;
    const durations = asBag(record['durations']);
    const timing = asBag(durations[options.priority ? 'priority' : 'standard']);
    return {
      rateId: readString(record, ['id', 'rate_id', '_id']) ?? '',
      courierName:
        readString(courier, ['company_name', 'companyName', 'business_name', 'name']) ??
        readString(record, ['courier_name', 'name']) ??
        'Courier',
      logoUrl: readString(readList(courier['uploads'])[0], ['link', 'url']),
      amount,
      priceLabel:
        formatMoney(amount, readString(record, ['currency', 'currency_code']) ?? undefined) ??
        'Not available',
      // Pickup happens before the clock the customer sees really starts, so only delivery shows.
      // Durations are days (BE confirmed 2026-10-06, after first calling them hours).
      deliveryWindow: this.daysLabel(timing['delivery_duration'] ?? record['delivery_duration']),
      rating: this.num(record['rating'] ?? courier['rating']),
      reviewCount: this.num(record['reviews'] ?? courier['reviews'] ?? record['review_count']),
    };
  }

  private daysLabel(value: unknown): string | null {
    const days = this.num(value);
    if (days === null) return null;
    return `${days} day${days === 1 ? '' : 's'}`;
  }

  /**
   * What the order will be charged: door pickup (the only pickup the app books) plus the chosen
   * delivery option, plus the priority extra. Null when this courier doesn't offer the choice.
   */
  private rateAmount(
    record: Record<string, unknown>,
    size: Record<string, unknown> | null,
    options: DeliveryOptions,
  ): number | null {
    const priorityExtra = this.num(asBag(asBag(record['extras'])['priority'])['cost']);
    if (options.priority && priorityExtra === null && !size) return null;

    if (size) {
      const pickup = this.optionCost(size['pickup_options'], 'user');
      const delivery = this.optionCost(size['delivery_options'], options.deliveryType);
      if (pickup === null || delivery === null) return null;
      if (!options.priority) return pickup + delivery;
      return priorityExtra === null ? null : pickup + delivery + priorityExtra;
    }
    const flat = Number(record['amount'] ?? record['price'] ?? record['cost'] ?? 0);
    return options.priority && priorityExtra !== null ? flat + priorityExtra : flat;
  }

  private optionCost(options: unknown, type: string): number | null {
    const option = readList(options)
      .map(asBag)
      .find((item) => item['type'] === type);
    return this.num(option?.['cost']);
  }

  private num(value: unknown): number | null {
    const parsed = typeof value === 'string' ? Number(value) : value;
    return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
  }

  private async options(path: string): Promise<Option[]> {
    const body = await firstValueFrom(this.http.get(this.apiUrl(path)));
    return readList(body)
      .map((item) => {
        const bag = asBag(item);
        const id = Number(bag['id'] ?? bag['_id']);
        const label = readString(bag, ['name', 'title', 'label', 'size', 'description']);
        return Number.isFinite(id) && label ? { id, label } : null;
      })
      .filter((option): option is Option => option !== null);
  }
}
