import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { Map as LibreMap } from 'maplibre-gl';
import { AddressSearch } from '../address-search/address-search';
import { DashboardPreferencesService } from '@core/services/dashboard-preferences.service';
import { GeocodingService, ReversePlace } from '@core/services/geocoding.service';
import type { PlaceDetails } from '@core/services/google-places.service';

export interface MapPickerStart {
  lat?: number;
  lon?: number;
  /** Typed address, used to centre the map when there are no coordinates yet. */
  query?: string;
}

type Status = 'zoom' | 'resolving' | 'ready' | 'unreadable';

/** Liberty names shops, schools, banks and landmarks, which the plain light and dark styles leave out. */
const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const NIGERIA_CENTER: [number, number] = [8.6753, 9.082];
const NIGERIA_BOUNDS: [number, number, number, number] = [2.6, 4.2, 14.7, 13.9];
/** City level is enough to read an address from; only the whole-country view is too wide. */
const MIN_ZOOM = 11;
const SETTLE_MS = 450;

/**
 * A modal map with a fixed centre pin: the customer moves the map under it and confirms. The
 * address under the pin comes from OpenStreetMap, never from the map tiles, so typing stays the fallback.
 */
@Component({
  selector: 'app-map-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AddressSearch],
  styleUrls: ['../../styles/forms.css', './map-picker.css'],
  templateUrl: './map-picker.html',
})
export class MapPicker implements OnDestroy {
  readonly heading = input('Pick on map');
  readonly picked = output<PlaceDetails>();

  private readonly geocoding = inject(GeocodingService);
  private readonly preferences = inject(DashboardPreferencesService);
  private readonly zone = inject(NgZone);
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly canvas = viewChild<ElementRef<HTMLElement>>('canvas');

  protected readonly status = signal<Status>('zoom');
  protected readonly place = signal<ReversePlace | null>(null);
  protected readonly moving = signal(false);
  protected readonly mapFailed = signal(false);
  protected readonly locating = signal(false);
  protected readonly locateError = signal<string | null>(null);
  protected readonly loadingMap = signal(false);
  protected readonly searchText = signal('');
  protected readonly searchMissed = signal(false);

  private map: LibreMap | null = null;
  private point: { lat: number; lon: number } | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private request = 0;
  private session = 0;
  private lastKey = '';

  async open(start: MapPickerStart): Promise<void> {
    const dialog = this.dialog()?.nativeElement;
    if (!dialog || dialog.open) return;
    const session = ++this.session;
    this.status.set('zoom');
    this.place.set(null);
    this.point = null;
    this.lastKey = '';
    this.searchText.set('');
    this.searchMissed.set(false);
    this.mapFailed.set(false);
    this.locateError.set(null);
    this.loadingMap.set(true);
    dialog.showModal();

    const origin = await this.startingPoint(start);
    if (session !== this.session) return;
    await this.build(origin);
    if (session === this.session) this.loadingMap.set(false);
  }

  protected close(): void {
    this.dialog()?.nativeElement.close();
  }

  /** A click on the dimmed area outside the sheet lands on the dialog element itself. */
  protected onBackdrop(event: MouseEvent): void {
    const dialog = this.dialog()?.nativeElement;
    if (!dialog || event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const outside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (outside) this.close();
  }

  protected onClosed(): void {
    this.session++;
    this.request++;
    clearTimeout(this.timer);
    this.map?.remove();
    this.map = null;
    this.moving.set(false);
  }

  protected onSearchPlace(place: PlaceDetails): void {
    if (place.latitude === null || place.longitude === null) return;
    this.searchText.set(place.formattedAddress || place.street);
    this.flyTo(place.longitude, place.latitude);
  }

  /** Enter on text Google didn't suggest (or with no Google key): look it up on OpenStreetMap instead. */
  protected async onSearchSubmit(text: string): Promise<void> {
    this.searchMissed.set(false);
    const found = await this.geocoding.locate(text);
    if (!found) {
      this.searchMissed.set(true);
      return;
    }
    this.flyTo(found.lon, found.lat);
  }

  private flyTo(lon: number, lat: number): void {
    this.map?.flyTo({
      center: [lon, lat],
      zoom: 17,
      duration: this.reducedMotion ? 0 : 900,
    });
  }

  protected confirm(): void {
    const place = this.place();
    const point = this.point;
    if (!place || !point || this.status() !== 'ready') return;
    this.picked.emit({
      placeId: `map:${point.lat.toFixed(6)},${point.lon.toFixed(6)}`,
      street: place.street,
      formattedAddress: place.formattedAddress,
      state: place.state,
      cityCandidates: place.cityCandidates,
      latitude: point.lat,
      longitude: point.lon,
    });
    this.close();
  }

  protected locate(): void {
    if (!this.map || !navigator.geolocation) {
      this.locateError.set("This browser can't share your location.");
      return;
    }
    this.locating.set(true);
    this.locateError.set(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        this.locating.set(false);
        this.map?.easeTo({
          center: [coords.longitude, coords.latitude],
          zoom: 16,
          duration: this.reducedMotion ? 0 : 700,
        });
      },
      (error) => {
        this.locating.set(false);
        this.locateError.set(
          error.code === error.PERMISSION_DENIED
            ? 'Location is blocked for this site. Allow it in your browser settings, or move the map.'
            : error.code === error.TIMEOUT
              ? 'Finding your location took too long. Try again, or move the map.'
              : "Your device couldn't work out where you are. Move the map instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  private get reducedMotion(): boolean {
    return (
      !this.preferences.motionEnabled() || matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  private async startingPoint(
    start: MapPickerStart,
  ): Promise<{ center: [number, number]; zoom: number }> {
    if (start.lat !== undefined && start.lon !== undefined) {
      return { center: [start.lon, start.lat], zoom: 17 };
    }
    const found = start.query ? await this.geocoding.locate(start.query) : null;
    if (found) return { center: [found.lon, found.lat], zoom: found.approximate ? 15 : 17 };
    return { center: NIGERIA_CENTER, zoom: 5 };
  }

  private async build(origin: { center: [number, number]; zoom: number }): Promise<void> {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const host = this.canvas()?.nativeElement;
    if (!host) return;
    try {
      const library = await import('maplibre-gl');
      if (!this.dialog()?.nativeElement.open) return;
      library.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
      const map = this.zone.runOutsideAngular(
        () =>
          new library.Map({
            container: host,
            style: STYLE,
            center: origin.center,
            zoom: origin.zoom,
            maxBounds: NIGERIA_BOUNDS,
            attributionControl: false,
          }),
      );
      this.map = map;
      map.addControl(new library.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new library.AttributionControl({ compact: true }), 'bottom-left');
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
      map.on('movestart', () => this.zone.run(() => this.moving.set(true)));
      map.on('moveend', () => this.zone.run(() => this.settle()));
      map.on('error', () => {
        if (!map.isStyleLoaded()) this.zone.run(() => this.mapFailed.set(true));
      });
      map.once('load', () => this.zone.run(() => this.settle()));
    } catch {
      this.mapFailed.set(true);
    }
  }

  private settle(): void {
    this.moving.set(false);
    const map = this.map;
    if (!map) return;
    const { lat, lng } = map.getCenter();
    // A resize (the footer changing height) also ends a "move" without moving the pin.
    const key = `${lat.toFixed(6)},${lng.toFixed(6)},${map.getZoom().toFixed(2)}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.point = { lat, lon: lng };
    clearTimeout(this.timer);
    const request = ++this.request;
    if (map.getZoom() < MIN_ZOOM) {
      this.place.set(null);
      this.status.set('zoom');
      return;
    }
    this.status.set('resolving');
    this.timer = setTimeout(async () => {
      const place = await this.geocoding.reverse(lat, lng);
      if (request !== this.request) return;
      this.place.set(place);
      this.status.set(place ? 'ready' : 'unreadable');
    }, SETTLE_MS);
  }

  ngOnDestroy(): void {
    this.session++;
    this.request++;
    clearTimeout(this.timer);
    this.map?.remove();
    this.map = null;
  }
}
