import { Injectable, InjectionToken, inject, isDevMode } from '@angular/core';

/** The browser Places key. Empty by default: the server hands it over at runtime, so it is never in git. */
export const GOOGLE_PLACES_KEY = new InjectionToken<string>('GOOGLE_PLACES_KEY', {
  providedIn: 'root',
  factory: () => '',
});

const CONFIG_URL = '/api/public-config';
/** Dev only: paste a key into this localStorage entry to try address search on `ng serve`. */
const DEV_KEY_STORAGE = 'fardelins.dev.googlePlacesKey';

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const DETAILS_URL = 'https://places.googleapis.com/v1/places';
const DETAILS_FIELDS = 'id,displayName,formattedAddress,location,addressComponents';
const TIMEOUT_MS = 8000;

export interface PlaceSuggestion {
  placeId: string;
  primary: string;
  secondary: string;
}

/** What the forms need from a picked place: our address line, Google's state and city names. */
export interface PlaceDetails {
  placeId: string;
  street: string;
  state: string;
  /** Most specific first (locality, sublocality, neighbourhood, then the LGA). */
  cityCandidates: string[];
  latitude: number | null;
  longitude: number | null;
}

interface RawComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

interface RawPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: RawComponent[];
}

const PLUS_CODE = /^[A-Z0-9]{4,8}\+[A-Z0-9]{2,}/i;
const DROPPED_TYPES = [
  'country',
  'administrative_area_level_1',
  'administrative_area_level_2',
  'locality',
  'postal_code',
];
const CITY_TYPES = [
  'locality',
  'sublocality_level_1',
  'sublocality',
  'neighborhood',
  'administrative_area_level_2',
];

/** Turns Google's place into our address line (without city, state, country) plus the parts to match. */
export function parsePlace(raw: RawPlace, fallbackStreet: string): PlaceDetails {
  const components = raw.addressComponents ?? [];
  const named = (type: string) =>
    components.find((component) => component.types?.includes(type))?.longText ?? '';

  const dropped = new Set<string>();
  for (const component of components) {
    if (!component.types?.some((type) => DROPPED_TYPES.includes(type))) continue;
    for (const text of [component.longText, component.shortText]) {
      if (text) dropped.add(text.toLowerCase());
    }
  }
  // Google writes the city with its postcode attached ("Abuja 900108"), so compare without it.
  const bare = (part: string) => part.replace(/\s+\d{5,6}$/, '').toLowerCase();
  const street = (raw.formattedAddress ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !PLUS_CODE.test(part) && !dropped.has(bare(part)))
    .join(', ');

  const cityCandidates = CITY_TYPES.map(named).filter(
    (name, index, all) => name && all.indexOf(name) === index,
  );

  return {
    placeId: raw.id ?? '',
    street: street || raw.displayName?.text || fallbackStreet,
    state: named('administrative_area_level_1'),
    cityCandidates,
    latitude: raw.location?.latitude ?? null,
    longitude: raw.location?.longitude ?? null,
  };
}

/** Address search over Google Places (New), called from the browser with a referrer-restricted key. */
@Injectable({ providedIn: 'root' })
export class GooglePlacesService {
  private key = inject(GOOGLE_PLACES_KEY);
  private keyLoad: Promise<void> | null = null;
  private sessionToken = crypto.randomUUID();

  /** Never throws: a failed search just means no suggestions. */
  async suggest(input: string): Promise<PlaceSuggestion[]> {
    if (input.trim().length < 3 || !(await this.hasKey())) return [];
    try {
      const body = await this.request<{
        suggestions?: {
          placePrediction?: {
            placeId?: string;
            text?: { text?: string };
            structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
          };
        }[];
      }>(AUTOCOMPLETE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input,
          includedRegionCodes: ['ng'],
          languageCode: 'en',
          sessionToken: this.sessionToken,
        }),
      });
      return (body.suggestions ?? []).flatMap((item) => {
        const prediction = item.placePrediction;
        if (!prediction?.placeId) return [];
        const primary = prediction.structuredFormat?.mainText?.text ?? prediction.text?.text ?? '';
        return [
          {
            placeId: prediction.placeId,
            primary,
            secondary: prediction.structuredFormat?.secondaryText?.text ?? '',
          },
        ];
      });
    } catch {
      return [];
    }
  }

  /** Ends the search session (Google bills a session as one lookup), so the next search starts fresh. */
  async details(suggestion: PlaceSuggestion): Promise<PlaceDetails | null> {
    if (!(await this.hasKey())) return null;
    const token = this.sessionToken;
    this.sessionToken = crypto.randomUUID();
    try {
      const raw = await this.request<RawPlace>(
        `${DETAILS_URL}/${encodeURIComponent(suggestion.placeId)}?sessionToken=${token}`,
        { headers: { 'X-Goog-FieldMask': DETAILS_FIELDS } },
      );
      return parsePlace({ ...raw, id: raw.id ?? suggestion.placeId }, suggestion.primary);
    } catch {
      return null;
    }
  }

  /** Asks the server for the key once. Without one the address field simply stays a plain text box. */
  private async hasKey(): Promise<boolean> {
    if (!this.key) {
      this.keyLoad ??= this.loadKey();
      await this.keyLoad;
    }
    return this.key.length > 0;
  }

  private async loadKey(): Promise<void> {
    try {
      const response = await fetch(CONFIG_URL);
      if (response.ok) {
        this.key = String(
          ((await response.json()) as { googlePlacesKey?: unknown }).googlePlacesKey ?? '',
        );
      }
    } catch {
      // Not reachable (for example `ng serve`): fall through to the dev fallback.
    }
    if (!this.key && isDevMode()) {
      try {
        this.key = localStorage.getItem(DEV_KEY_STORAGE) ?? '';
      } catch {
        this.key = '';
      }
    }
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        ...init,
        headers: { ...init.headers, 'X-Goog-Api-Key': this.key },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Places request failed (${response.status})`);
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
