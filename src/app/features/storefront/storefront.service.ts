import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@core/auth/auth.service';
import { parseApiError } from '@core/auth/auth.models';
import { injectLogisticsApiUrl } from '@core/services/logistics-api.config';
import { LocalityService } from '@core/services/locality.service';
import { MOCK_COURIERS } from '../../dev/mock-couriers';
import {
  PreferredCourier,
  Storefront,
  StorefrontInput,
  StorefrontLocation,
} from './storefront.models';

type Bag = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class StorefrontService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly apiUrl = injectLogisticsApiUrl();
  private readonly locality = inject(LocalityService);
  private mockStorefronts: Storefront[] = [];
  private readonly mockKeys = new Map<string, string>();

  async list(): Promise<Storefront[]> {
    if (this.auth.isMockSession()) return [...this.mockStorefronts];

    try {
      const body = await firstValueFrom(this.http.get(this.apiUrl('/user/properties')));
      return readList(body)
        .map(toStorefront)
        .filter((item): item is Storefront => item !== null);
    } catch (error) {
      throw new Error(parseApiError(error, "We couldn't load your storefronts."));
    }
  }

  async create(input: StorefrontInput): Promise<Storefront | null> {
    if (this.auth.isMockSession()) {
      const storefront = mockStorefront(input);
      this.mockStorefronts = [...this.mockStorefronts, storefront];
      return storefront;
    }

    try {
      const body = await firstValueFrom(
        this.http.post(this.apiUrl('/user/property'), cleanInput(input)),
      );
      return toStorefront(readRecord(body));
    } catch (error) {
      throw new Error(parseApiError(error, "We couldn't add that storefront."));
    }
  }

  async update(id: string, input: StorefrontInput): Promise<Storefront | null> {
    if (this.auth.isMockSession()) {
      const current = this.mockStorefronts.find((item) => item.id === id);
      if (!current) return null;
      const storefront = mergeStorefront(current, input);
      this.mockStorefronts = this.mockStorefronts.map((item) =>
        item.id === id ? storefront : item,
      );
      return storefront;
    }

    try {
      const body = await firstValueFrom(
        this.http.patch(this.apiUrl(`/user/property/${encodeURIComponent(id)}`), cleanInput(input)),
      );
      return toStorefront(readRecord(body));
    } catch (error) {
      throw new Error(parseApiError(error, "We couldn't save that storefront."));
    }
  }

  async remove(id: string): Promise<void> {
    if (this.auth.isMockSession()) {
      this.mockStorefronts = this.mockStorefronts.filter((item) => item.id !== id);
      this.mockKeys.delete(id);
      return;
    }

    try {
      await firstValueFrom(
        this.http.delete(this.apiUrl(`/user/property/${encodeURIComponent(id)}`)),
      );
    } catch (error) {
      throw new Error(parseApiError(error, "We couldn't remove that storefront."));
    }
  }

  async preferredCouriers(page = 1, limit = 10): Promise<PreferredCourier[]> {
    if (this.auth.isMockSession()) {
      const start = Math.max(0, page - 1) * limit;
      return MOCK_COURIERS.slice(start, start + limit).map(
        ({ id, name, logoUrl, rating, reviewCount, amount, deliveryWindow }) => ({
          id,
          name,
          logoUrl,
          rating,
          reviewCount,
          priceLabel: `From ₦${amount.toLocaleString('en-NG')}`,
          deliveryWindow,
        }),
      );
    }

    try {
      // BE named /user/couriers the source of truth for this list (2026-10-02). country_id is
      // required; the response pages with page/limit/has_next_page.
      const countryId = await this.locality.countryId('Nigeria');
      const body = await firstValueFrom(
        this.http.get(this.apiUrl('/user/couriers'), {
          params: {
            ...(countryId !== null ? { country_id: String(countryId) } : {}),
            page: String(page),
            limit: String(limit),
          },
        }),
      );
      return readList(body)
        .map(toPreferredCourier)
        .filter((item): item is PreferredCourier => item !== null);
    } catch (error) {
      throw new Error(parseApiError(error, "We couldn't load couriers."));
    }
  }

  async revealKey(id: string): Promise<string> {
    if (this.auth.isMockSession()) {
      const key = this.mockKeys.get(id);
      if (!key) throw new Error('Create an API key for this storefront first.');
      return key;
    }

    try {
      const body = await firstValueFrom(
        this.http.get(this.apiUrl(`/user/view-property-key/${encodeURIComponent(id)}`)),
      );
      const value = readScalar(body);
      if (!value) throw new Error('No API key was returned.');
      return value;
    } catch (error) {
      if (error instanceof Error && error.message === 'No API key was returned.') throw error;
      throw new Error(parseApiError(error, "We couldn't reveal that API key."));
    }
  }

  async generateKey(id: string): Promise<string> {
    if (this.auth.isMockSession()) {
      const key = `demo_${cryptoId().replaceAll('-', '')}`;
      this.mockKeys.set(id, key);
      return key;
    }

    try {
      await firstValueFrom(
        this.http.get(this.apiUrl(`/user/generate-property-key/${encodeURIComponent(id)}`)),
      );
      return this.revealKey(id);
    } catch (error) {
      throw new Error(parseApiError(error, "We couldn't generate a new API key."));
    }
  }
}

function toStorefront(source: unknown): Storefront | null {
  const record = asBag(source);
  const id = readString(record, ['id', '_id', 'property_id', 'propertyId']);
  const name = readString(record, ['name', 'business_name', 'title']);
  if (!id || !name) return null;

  const locationSource = record['location'];
  const preferredSource =
    record['preferred_courier_ids'] ??
    record['preferredCourierIds'] ??
    record['preferred_couriers'];

  return {
    id,
    name,
    email: readString(record, ['email', 'business_email', 'contact_email']) ?? '',
    phone: readString(record, ['phone', 'business_phone', 'contact_phone']) ?? '',
    description: readString(record, ['description']),
    website: readString(record, ['website', 'url']),
    location: locationSource ? toLocation(locationSource) : null,
    preferredCourierIds: readIds(preferredSource),
    createdAt: readString(record, ['created_at', 'createdAt']),
    updatedAt: readString(record, ['updated_at', 'updatedAt']),
  };
}

function toLocation(source: unknown): StorefrontLocation | null {
  const record = asBag(source);
  const address = readString(record, ['address', 'formatted_address', 'name']);
  if (!address) return null;
  return {
    id: readString(record, ['id', 'cuid', '_id']),
    address,
    cityId: readNumber(record, ['city_id', 'cityId']),
    stateId: readNumber(record, ['state_id', 'stateId']),
    countryId: readNumber(record, ['country_id', 'countryId']),
    latitude: readNumber(record, ['latitude', 'lat']),
    longitude: readNumber(record, ['longitude', 'lng', 'lon']),
    zipCode: readString(record, ['zip_code', 'zipCode', 'postal_code']),
  };
}

function toPreferredCourier(source: unknown): PreferredCourier | null {
  const record = asBag(source);
  const account = asBag(record['account'] ?? record['business'] ?? record['courier']);
  const id =
    readString(record, ['id', '_id', 'courier_id', 'courierId']) ??
    readString(account, ['id', '_id']);
  const name =
    readString(record, ['business_name', 'company_name', 'name', 'title']) ??
    readString(account, ['business_name', 'company_name', 'name']);
  if (!id || !name) return null;
  return {
    id,
    name,
    logoUrl:
      readString(record, ['logo', 'logo_url', 'image']) ??
      readString(account, ['logo', 'logo_url', 'image']),
    // /user/couriers returns average_delivery_rating and rating_count (0 when unrated, which
    // the UI hides). Price and delivery window aren't part of a courier, only of a rate.
    rating:
      readNumber(record, ['average_delivery_rating', 'rating', 'average_rating']) ??
      readNumber(account, ['rating', 'average_rating']),
    reviewCount:
      readNumber(record, ['review_count', 'reviews_count', 'total_reviews', 'rating_count']) ??
      readNumber(account, ['review_count', 'reviews_count']),
    priceLabel: readString(record, ['price_label', 'formatted_price', 'rate_label']),
    deliveryWindow: readString(record, [
      'delivery_window',
      'eta',
      'delivery_time',
      'estimated_delivery',
    ]),
  };
}

function cleanInput(input: StorefrontInput): StorefrontInput {
  return {
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    ...(input.description?.trim() ? { description: input.description.trim() } : {}),
    ...(input.website?.trim() ? { website: input.website.trim() } : {}),
    ...(input.location?.address.trim()
      ? { location: { ...input.location, address: input.location.address.trim() } }
      : {}),
    ...(input.preferred_courier_ids?.length
      ? { preferred_courier_ids: [...input.preferred_courier_ids] }
      : {}),
  };
}

function mockStorefront(input: StorefrontInput): Storefront {
  const now = new Date().toISOString();
  return {
    id: cryptoId(),
    name: input.name,
    email: input.email,
    phone: input.phone,
    description: input.description ?? null,
    website: input.website ?? null,
    location: input.location
      ? {
          id: null,
          address: input.location.address,
          cityId: input.location.city_id ?? null,
          stateId: input.location.state_id ?? null,
          countryId: input.location.country_id ?? null,
          latitude: input.location.latitude ?? null,
          longitude: input.location.longitude ?? null,
          zipCode: input.location.zip_code ?? null,
        }
      : null,
    preferredCourierIds: input.preferred_courier_ids ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

function mergeStorefront(current: Storefront, input: StorefrontInput): Storefront {
  return {
    ...mockStorefront(input),
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  };
}

function readIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item : readString(asBag(item), ['id', '_id'])))
    .filter((item): item is string => Boolean(item));
}

function readList(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const record = asBag(body);
  for (const key of ['data', 'items', 'results', 'records', 'couriers', 'properties']) {
    const value = record[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      const nested = readList(value);
      if (nested.length) return nested;
    }
  }
  return [];
}

function readRecord(body: unknown): Bag {
  const record = asBag(body);
  const data = record['data'];
  return data && typeof data === 'object' && !Array.isArray(data) ? asBag(data) : record;
}

function readScalar(body: unknown): string | null {
  if (typeof body === 'string' && body.trim()) return body.trim();
  const record = asBag(body);
  return readString(record, ['data', 'key', 'access_key', 'accessKey']);
}

function readString(record: Bag, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return null;
}

function readNumber(record: Bag, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = Number(record[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function asBag(value: unknown): Bag {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Bag) : {};
}

function cryptoId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `storefront-${Date.now()}`;
}
