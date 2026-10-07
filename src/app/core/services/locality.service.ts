import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { injectLogisticsApiUrl } from './logistics-api.config';

export interface LocalityOption {
  id: number;
  label: string;
}

type Bag = Record<string, unknown>;

/**
 * Shared country-id lookups. Several features need Nigeria's locality id (a required
 * query/body param in a few endpoints) without hardcoding what could be an environment-specific
 * seed value.
 */
@Injectable({ providedIn: 'root' })
export class LocalityService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = injectLogisticsApiUrl();
  private countriesCache: Promise<LocalityOption[]> | null = null;

  countries(): Promise<LocalityOption[]> {
    this.countriesCache ??= this.fetchCountries();
    return this.countriesCache;
  }

  async countryId(name = 'Nigeria'): Promise<number | null> {
    const countries = await this.countries();
    return countries.find((c) => c.label.toLowerCase() === name.toLowerCase())?.id ?? null;
  }

  private async fetchCountries(): Promise<LocalityOption[]> {
    const body = await firstValueFrom(this.http.get(this.apiUrl('/locality/countries')));
    return readList(body)
      .map((item) => {
        const bag = asBag(item);
        const id = Number(bag['id'] ?? bag['_id']);
        const label = readString(bag, ['name', 'title', 'label']);
        return Number.isFinite(id) && label ? { id, label } : null;
      })
      .filter((option): option is LocalityOption => option !== null);
  }
}

function asBag(value: unknown): Bag {
  return value && typeof value === 'object' ? (value as Bag) : {};
}

function readString(source: unknown, keys: string[]): string | null {
  const bag = asBag(source);
  for (const key of keys) {
    const value = bag[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function readList(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const bag = asBag(body);
  const data = bag['data'];
  return Array.isArray(data) ? data : [];
}
