import {
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  PLATFORM_ID,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { FeatureCollection } from 'geojson';
import type { Map as LibreMap, Marker, GeoJSONSource } from 'maplibre-gl';
import { DashboardPreferencesService } from '@core/services/dashboard-preferences.service';
import { mapMarkerElement } from './route-map-markers';
import { routeProgress } from './route-progress';

export interface MapPoint {
  lat: number;
  lon: number;
  label: string;
  kind: 'pickup' | 'dropoff';
}
const STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

@Component({
  selector: 'app-route-map',
  templateUrl: './route-map.html',
  styleUrl: './route-map.css',
})
export class RouteMap implements OnDestroy {
  readonly points = input<MapPoint[]>([]);
  readonly route = input<[number, number][]>([]);
  readonly marker = input<[number, number] | null>(null);
  readonly overview = input<[number, number]>([8.6753, 9.082]);
  readonly bottomInset = input(48);
  readonly topFade = input(false);
  private readonly preferences = inject(DashboardPreferencesService);
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly canvas = viewChild<ElementRef<HTMLElement>>('canvas');
  protected readonly ready = signal(false);
  protected readonly failed = signal(false);
  private map: LibreMap | null = null;
  private library: typeof import('maplibre-gl') | null = null;
  private markers: Marker[] = [];
  private resizeObserver?: ResizeObserver;
  private building = false;
  private destroyed = false;
  private theme = '';
  private styleReady = false;
  private frame = 0;
  private lastRouteKey = '';
  private riderMarkerRef: Marker | null = null;
  private lastRiderPoint: [number, number] | null = null;
  private riderFrame = 0;

  constructor() {
    effect(() => {
      this.canvas();
      this.points();
      this.route();
      this.marker();
      this.overview();
      this.bottomInset();
      this.topFade();
      this.preferences.effectiveTheme();
      this.preferences.motionEnabled();
      if (this.isBrowser) this.zone.runOutsideAngular(() => void this.render());
    });
  }

  private get duration(): number {
    return !this.preferences.motionEnabled() ||
      matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : 850;
  }

  private async render(): Promise<void> {
    const host = this.canvas()?.nativeElement;
    if (!host || this.destroyed) return;
    if (this.map) {
      const theme = this.preferences.effectiveTheme();
      if (theme !== this.theme) {
        this.theme = theme;
        this.styleReady = false;
        cancelAnimationFrame(this.frame);
        this.map.setStyle(STYLES[theme]);
      } else if (this.styleReady) this.update();
      return;
    }
    if (this.building) return;
    this.building = true;
    try {
      this.library = await import('maplibre-gl');
      if (this.destroyed) return;
      this.library.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      this.theme = this.preferences.effectiveTheme();
      const map = new this.library.Map({
        container: host,
        style: STYLES[this.preferences.effectiveTheme()],
        center: this.overview(),
        zoom: 5,
        attributionControl: false,
        interactive: true,
      });
      this.map = map;
      map.addControl(new this.library.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new this.library.AttributionControl({ compact: true }), 'bottom-right');
      requestAnimationFrame(() => this.collapseAttribution(host));
      map.once('idle', () => this.collapseAttribution(host));
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
      map.on('style.load', () => {
        this.styleReady = true;
        this.update();
        this.zone.run(() => {
          this.ready.set(true);
          this.failed.set(false);
        });
      });
      map.on('error', () => {
        if (!this.styleReady)
          this.zone.run(() => {
            this.failed.set(true);
            this.ready.set(false);
          });
      });
      this.resizeObserver = new ResizeObserver(() => map.resize());
      this.resizeObserver.observe(host);
    } catch (error) {
      this.zone.run(() => this.failed.set(true));
      console.warn('[route-map] Map unavailable', error);
    } finally {
      this.building = false;
    }
  }

  private update(): void {
    const map = this.map;
    if (!map || !this.library) return;
    cancelAnimationFrame(this.frame);
    for (const marker of this.markers) marker.remove();
    this.markers = [];
    const points = this.points();
    const route = this.route();
    for (const point of points) {
      const el = mapMarkerElement(
        point.kind,
        `${point.kind === 'pickup' ? 'From' : 'To'}: ${point.label}`,
      );
      this.markers.push(
        new this.library.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([point.lon, point.lat])
          .addTo(map),
      );
    }
    const rider = this.marker();
    const split = routeProgress(route, rider);
    this.updateRiderMarker(map, rider, split.bearing);
    const color =
      getComputedStyle(this.canvas()!.nativeElement)
        .getPropertyValue('--parcel-status-transit')
        .trim() || '#521c99';
    for (const id of ['route', 'route-travelled']) {
      if (map.getSource(id)) continue;
      map.addSource(id, { type: 'geojson', data: this.lineData([]) });
      map.addLayer({
        id: `${id}-casing`,
        type: 'line',
        source: id,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': 8,
          'line-opacity': 0.55,
          ...(id === 'route-travelled' ? { 'line-dasharray': [1, 1.5] } : {}),
        },
      });
      map.addLayer({
        id: `${id}-line`,
        type: 'line',
        source: id,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': color,
          'line-width': 4,
          ...(id === 'route-travelled' ? { 'line-dasharray': [1, 1.5], 'line-opacity': 0.65 } : {}),
        },
      });
    }
    const source = map.getSource('route') as GeoJSONSource;
    const travelled = map.getSource('route-travelled') as GeoJSONSource;
    // A poll refresh sends the same road back: set it directly instead of replaying the sweep-in.
    const routeKey = JSON.stringify(route);
    const routeChanged = routeKey !== this.lastRouteKey;
    this.lastRouteKey = routeKey;
    if (!routeChanged) {
      source.setData(this.lineData(split.remaining));
      travelled.setData(this.lineData(split.travelled));
    } else {
      const duration = this.duration;
      const start = performance.now();
      const draw = (now: number): void => {
        const progress = duration ? Math.min((now - start) / duration, 1) : 1;
        source.setData(
          this.lineData(
            split.remaining.slice(0, Math.max(2, Math.ceil(split.remaining.length * progress))),
          ),
        );
        travelled.setData(
          this.lineData(
            split.travelled.slice(0, Math.max(2, Math.ceil(split.travelled.length * progress))),
          ),
        );
        if (progress < 1 && route.length > 1) this.frame = requestAnimationFrame(draw);
      };
      draw(start);
    }
    this.recenter();
  }

  // One persistent marker instance so a moved rider tweens instead of popping.
  private updateRiderMarker(
    map: LibreMap,
    rider: [number, number] | null,
    bearing: number,
  ): void {
    if (!this.library) return;
    cancelAnimationFrame(this.riderFrame);
    if (!rider) {
      this.riderMarkerRef?.remove();
      this.riderMarkerRef = null;
      this.lastRiderPoint = null;
      return;
    }
    const label = 'Rider: Dispatcher is enroute to deliver the package';
    if (!this.riderMarkerRef) {
      this.riderMarkerRef = new this.library.Marker({
        element: mapMarkerElement('rider', label, bearing),
      })
        .setLngLat(rider)
        .addTo(map);
      this.lastRiderPoint = rider;
      return;
    }
    const from = this.lastRiderPoint;
    this.lastRiderPoint = rider;
    const fresh = mapMarkerElement('rider', label, bearing);
    this.riderMarkerRef.getElement().innerHTML = fresh.innerHTML;
    const unmoved = from && from[0] === rider[0] && from[1] === rider[1];
    const duration = this.duration;
    if (!from || unmoved || !duration) {
      this.riderMarkerRef.setLngLat(rider);
      return;
    }
    const marker = this.riderMarkerRef;
    const start = performance.now();
    const tick = (now: number): void => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      marker.setLngLat([from[0] + (rider[0] - from[0]) * eased, from[1] + (rider[1] - from[1]) * eased]);
      if (t < 1) this.riderFrame = requestAnimationFrame(tick);
    };
    this.riderFrame = requestAnimationFrame(tick);
  }

  protected recenter(): void {
    const map = this.map;
    if (!map || !this.library) return;
    // Cancel drag inertia or a previous camera animation before restoring the route.
    map.stop();
    const points = this.points();
    const route = this.route();
    const duration = this.duration;
    const all = [...points.map((p) => [p.lon, p.lat] as [number, number]), ...route];
    const padding = { top: 65, right: 65, bottom: this.bottomInset(), left: 55 };
    if (!all.length) {
      map.easeTo({
        center: this.overview(),
        zoom: 5,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        duration,
      });
      return;
    }
    const bounds = new this.library.LngLatBounds(all[0], all[0]);
    all.forEach((point) => bounds.extend(point));
    map.fitBounds(bounds, { padding, maxZoom: 14, duration });
  }

  private collapseAttribution(host: HTMLElement): void {
    const attribution = host.querySelector<HTMLElement>('.maplibregl-ctrl-attrib');
    attribution?.classList.remove('maplibregl-compact-show');
    attribution
      ?.querySelector<HTMLButtonElement>('.maplibregl-ctrl-attrib-button')
      ?.setAttribute('aria-expanded', 'false');
  }

  private lineData(coordinates: [number, number][]): FeatureCollection {
    return {
      type: 'FeatureCollection',
      features:
        coordinates.length < 2
          ? []
          : [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } }],
    };
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.isBrowser) {
      cancelAnimationFrame(this.frame);
      cancelAnimationFrame(this.riderFrame);
    }
    this.resizeObserver?.disconnect();
    this.markers.forEach((marker) => marker.remove());
    this.riderMarkerRef?.remove();
    this.map?.remove();
    this.map = null;
  }
}
