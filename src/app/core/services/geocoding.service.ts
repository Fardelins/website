import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Komoot's public Photon instance: OpenStreetMap data, no key, no account. */
const PHOTON = 'https://photon.komoot.io/api';
const PHOTON_REVERSE = 'https://photon.komoot.io/reverse';
/** Keeps a bare "Lekki" from resolving to a same-named place abroad. */
const NIGERIA_BBOX = '2.67,4.27,14.68,13.89';
const CACHE_PREFIX = 'fardelins.geo.';
const REQUEST_TIMEOUT_MS = 8000;
const FOUND_TTL_MS = 30 * 86_400_000;
const NOT_FOUND_TTL_MS = 86_400_000;
const FAILED = { point: null, failed: true } as const;

interface Lookup {
  point: GeoPoint | null;
  /** The request itself failed (network, timeout, server), so "no point" must not be remembered. */
  failed: boolean;
}

export interface GeoPoint {
  lat: number;
  lon: number;
  /** What Photon actually matched, which is often broader than what was asked for. */
  matched: string;
  /** True when the lookup fell back to a shorter fragment than the full address. */
  approximate: boolean;
}

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly inflight = new Map<string, Promise<GeoPoint | null>>();

  /** The address nearest a map point, shaped like a Google place so the same form-filling code takes it. */
  async reverse(lat: number, lon: number): Promise<ReversePlace | null> {
    if (!this.isBrowser) return null;
    try {
      const response = await fetch(`${PHOTON_REVERSE}?lon=${lon}&lat=${lat}&lang=en`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) return null;
      const body = (await response.json()) as PhotonResponse;
      const props = body.features?.[0]?.properties;
      if (!props) return null;

      const onStreet = props.type === 'street' || props.type === 'house';
      const road = props.street ?? (props.type === 'street' ? props.name : undefined);
      const lines = [
        onStreet ? undefined : props.name,
        [props.housenumber, road].filter(Boolean).join(' '),
      ].filter((line): line is string => Boolean(line));
      const area = props.district ?? props.locality;
      const unique = (items: (string | undefined)[]) => [
        ...new Set(items.filter((item): item is string => Boolean(item))),
      ];
      const formattedAddress = unique([...lines, area, props.city, props.state]).join(', ');
      if (!formattedAddress || !props.state) return null;
      return {
        street: lines.join(', ') || area || props.city || '',
        formattedAddress,
        state: props.state,
        // The state is the last resort: for Abuja and Lagos it is also a city in our lists.
        cityCandidates: unique([props.city, area, props.county, props.state]),
      };
    } catch {
      return null;
    }
  }

  /** Country overview must not use the Nigerian address bounding box. */
  async locateCountry(country: string): Promise<GeoPoint | null> {
    if (!this.isBrowser || !country.trim()) return null;
    try {
      const response = await fetch(
        `${PHOTON}?q=${encodeURIComponent(country)}&layer=country&limit=1`,
        {
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      if (!response.ok) return null;
      const body = (await response.json()) as PhotonResponse;
      const [lon, lat] = body.features?.[0]?.geometry?.coordinates ?? [];
      return typeof lon === 'number' && typeof lat === 'number'
        ? { lon, lat, matched: country, approximate: true }
        : null;
    } catch {
      return null;
    }
  }

  /**
   * Nigerian addresses are commonly written "No 34b, Prince Bode str, Lekki, Lagos",
   * and Photon returns nothing for the full string. Dropping leading segments walks
   * the query from doorstep towards city until something matches.
   */
  async locate(address: string | null | undefined): Promise<GeoPoint | null> {
    if (!this.isBrowser || !address?.trim()) return null;

    const key = address.trim().toLowerCase();
    const cached = this.readCache(key);
    if (cached !== undefined) return cached;

    const existing = this.inflight.get(key);
    if (existing) return existing;

    const pending = this.resolve(address.trim())
      .then(({ point, failed }) => {
        if (!failed) this.writeCache(key, point);
        return point;
      })
      .finally(() => this.inflight.delete(key));

    this.inflight.set(key, pending);
    return pending;
  }

  private async resolve(address: string): Promise<Lookup> {
    const parts = address
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    let failed = false;
    for (let i = 0; i < parts.length; i++) {
      const query = parts.slice(i).join(', ');
      const result = await this.lookup(query);
      if (result.point) {
        return {
          point: { ...result.point, approximate: i > 0 || result.point.approximate },
          failed: false,
        };
      }
      failed ||= result.failed;
    }
    return { point: null, failed };
  }

  private async lookup(query: string): Promise<Lookup> {
    const url = `${PHOTON}?q=${encodeURIComponent(query)}&limit=1&bbox=${NIGERIA_BBOX}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!response.ok) return FAILED;
      const body = (await response.json()) as PhotonResponse;
      const feature = body.features?.[0];
      const [lon, lat] = feature?.geometry?.coordinates ?? [];
      if (typeof lat !== 'number' || typeof lon !== 'number') return { point: null, failed: false };

      const props = feature?.properties ?? {};
      return {
        point: {
          lat,
          lon,
          matched: [props.name, props.city, props.state].filter(Boolean).join(', ') || query,
          // Street-level matches on informal addresses are fuzzy even on a direct hit.
          approximate: !props.housenumber,
        },
        failed: false,
      };
    } catch {
      return FAILED;
    }
  }

  private readCache(key: string): GeoPoint | null | undefined {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (raw === null) return undefined;
      const entry = JSON.parse(raw) as { v: GeoPoint | null; exp: number };
      if (!(entry.exp > Date.now())) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return undefined;
      }
      return entry.v;
    } catch {
      return undefined;
    }
  }

  private writeCache(key: string, point: GeoPoint | null): void {
    try {
      const exp = Date.now() + (point ? FOUND_TTL_MS : NOT_FOUND_TTL_MS);
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ v: point, exp }));
    } catch {
      // Private mode or quota: the lookup just repeats next time.
    }
  }
}

export interface ReversePlace {
  street: string;
  formattedAddress: string;
  state: string;
  cityCandidates: string[];
}

interface PhotonResponse {
  features?: {
    geometry?: { coordinates?: [number, number] };
    properties?: {
      name?: string;
      type?: string;
      street?: string;
      housenumber?: string;
      district?: string;
      locality?: string;
      city?: string;
      county?: string;
      state?: string;
    };
  }[];
}
