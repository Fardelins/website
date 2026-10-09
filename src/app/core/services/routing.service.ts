import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GeoPoint } from './geocoding.service';

/** OSRM's public demo server: OpenStreetMap roads, no key, no account. */
const OSRM = 'https://router.project-osrm.org/route/v1/driving';
const CACHE_PREFIX = 'fardelins.route.';
const REQUEST_TIMEOUT_MS = 12000;

export interface RoadRoute {
  /** [lon, lat] pairs along the driven road, ready for a GeoJSON LineString. */
  coordinates: [number, number][];
  distanceKm: number;
  durationMin: number;
}

@Injectable({ providedIn: 'root' })
export class RoutingService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly inflight = new Map<string, Promise<RoadRoute | null>>();

  async route(from: GeoPoint, to: GeoPoint): Promise<RoadRoute | null> {
    if (!this.isBrowser) return null;

    const key = [from.lon, from.lat, to.lon, to.lat].map((n) => n.toFixed(4)).join(',');
    const cached = this.readCache(key);
    if (cached !== undefined) return cached;

    const existing = this.inflight.get(key);
    if (existing) return existing;

    const pending = this.fetchRoute(from, to)
      .then((result) => {
        this.writeCache(key, result);
        return result;
      })
      .finally(() => this.inflight.delete(key));

    this.inflight.set(key, pending);
    return pending;
  }

  /** Where along the road the parcel sits, as [lon, lat] at `progress` (0..1). */
  pointAt(route: RoadRoute, progress: number): [number, number] {
    const points = route.coordinates;
    if (points.length < 2) return points[0] ?? [0, 0];

    const clamped = Math.min(Math.max(progress, 0), 1);
    // Walk by real distance, not index: OSRM points bunch up around junctions, so
    // indexing straight into the array would stall the marker at every corner.
    const spans: number[] = [];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const span = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
      spans.push(span);
      total += span;
    }

    let travelled = total * clamped;
    for (let i = 0; i < spans.length; i++) {
      if (travelled <= spans[i] || spans[i] === 0) {
        const t = spans[i] === 0 ? 0 : travelled / spans[i];
        return [
          points[i][0] + (points[i + 1][0] - points[i][0]) * t,
          points[i][1] + (points[i + 1][1] - points[i][1]) * t,
        ];
      }
      travelled -= spans[i];
    }
    return points[points.length - 1];
  }

  private async fetchRoute(from: GeoPoint, to: GeoPoint): Promise<RoadRoute | null> {
    const path = `${from.lon},${from.lat};${to.lon},${to.lat}`;
    const url = `${OSRM}/${path}?overview=full&geometries=geojson`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!response.ok) return null;
      const body = (await response.json()) as OsrmResponse;
      const route = body.routes?.[0];
      const coordinates = route?.geometry?.coordinates;
      if (body.code !== 'Ok' || !coordinates?.length) return null;
      return {
        coordinates,
        distanceKm: (route?.distance ?? 0) / 1000,
        durationMin: (route?.duration ?? 0) / 60,
      };
    } catch {
      return null;
    }
  }

  private readCache(key: string): RoadRoute | null | undefined {
    try {
      const raw = sessionStorage.getItem(CACHE_PREFIX + key);
      return raw === null ? undefined : (JSON.parse(raw) as RoadRoute | null);
    } catch {
      return undefined;
    }
  }

  private writeCache(key: string, route: RoadRoute | null): void {
    try {
      sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(route));
    } catch {
      // Quota or private mode: the route is just fetched again next time.
    }
  }
}

interface OsrmResponse {
  code?: string;
  routes?: {
    distance?: number;
    duration?: number;
    geometry?: { coordinates?: [number, number][] };
  }[];
}
