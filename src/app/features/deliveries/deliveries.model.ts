import { TrackingEvent } from '@features/tracking/tracking.model';

export interface DeliverySummary {
  trackingId: string;
  /** The shipment's UUID, which cancelling needs; the customer-facing code is `trackingId`. */
  shipmentId?: string | null;
  /** The order's UUID, which restarting payment needs. */
  orderId?: string | null;
  title: string;
  status: string;
  imageUrl: string | null;
  createdLabel: string;
  dropOff: string | null;
  etaLabel: string | null;
  amountLabel: string | null;
  createdAt?: string | null;
  etaAt?: string | null;
  amount?: number | null;
  currency?: string | null;
  receiverName?: string | null;
}

/** Advanced parcel filters, sent to the API as-is. Dates are YYYY-MM-DD from a date input. */
export interface ParcelFilters {
  dateFrom: string;
  dateTo: string;
  minPrice: number | null;
  maxPrice: number | null;
  state: string;
  city: string;
}

export const EMPTY_PARCEL_FILTERS: ParcelFilters = {
  dateFrom: '',
  dateTo: '',
  minPrice: null,
  maxPrice: null,
  state: '',
  city: '',
};

export function hasParcelFilters(filters: ParcelFilters): boolean {
  return Boolean(
    filters.dateFrom ||
    filters.dateTo ||
    filters.minPrice !== null ||
    filters.maxPrice !== null ||
    filters.state,
  );
}

/** Query params for GET /customer-shipment/shipments. `location` needs a state; city is optional. */
export function parcelFilterParams(filters: ParcelFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.dateFrom) params['date_from'] = filters.dateFrom;
  if (filters.dateTo) params['date_to'] = filters.dateTo;
  if (filters.minPrice !== null) params['min_price'] = String(filters.minPrice);
  if (filters.maxPrice !== null) params['max_price'] = String(filters.maxPrice);
  if (filters.state) {
    params['location[country]'] = 'nigeria';
    params['location[state]'] = filters.state;
    if (filters.city) params['location[city]'] = filters.city;
  }
  return params;
}

export interface DeliveryDetail extends DeliverySummary {
  senderName: string | null;
  receiverName: string | null;
  pickupAddress: string | null;
  dropOffAddress: string | null;
  courierName: string | null;
  distanceLabel: string | null;
  pickupCoords?: { lat: number; lon: number } | null;
  dropOffCoords?: { lat: number; lon: number } | null;
  images?: string[];
  description?: string | null;
  categoryLabel?: string | null;
  parcelTypeLabel?: string | null;
  dimensionsLabel?: string | null;
  quantity?: number | null;
  worthLabel?: string | null;
  deliveryTypeLabel?: string | null;
  /** When the row last changed; for a cancelled shipment that is when it was cancelled. */
  updatedLabel?: string | null;
  senderPhone?: string | null;
  senderEmail?: string | null;
  receiverPhone?: string | null;
  receiverEmail?: string | null;
  courierContact?: string | null;
  // Optional: not every mock entry carries these, and the live API's weight/size field names aren't confirmed yet.
  weightLabel?: string | null;
  boxTypeLabel?: string | null;
  paid: boolean;
  events: TrackingEvent[];
  currentPhaseIndex: number;
}

type Bag = Record<string, unknown>;

export const asBag = (value: unknown): Bag =>
  value && typeof value === 'object' ? (value as Bag) : {};

export function readString(source: unknown, keys: string[]): string | null {
  const bag = asBag(source);
  for (const key of keys) {
    const value = bag[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return null;
}

/** Unwraps `{ data: [...] }` / `{ data: { items: [...] } }`, the API uses both. */
export function readList(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  const bag = asBag(body);
  for (const key of ['data', 'items', 'results', 'shipments', 'orders']) {
    const value = bag[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      const nested = readList(value);
      if (nested.length) return nested;
    }
  }
  return [];
}

/**
 * True when the response says more pages exist. BE sends `has_next_page`, plus `page` and
 * `total_pages`; where they sit in the envelope isn't documented, so each level is checked.
 */
export function hasNextPage(body: unknown): boolean {
  const root = asBag(body);
  return [root, asBag(root['data']), asBag(root['meta']), asBag(root['pagination'])].some((bag) => {
    if (bag['has_next_page'] === true) return true;
    const page = Number(bag['page']);
    const totalPages = Number(bag['total_pages']);
    return Number.isFinite(page) && Number.isFinite(totalPages) && page < totalPages;
  });
}

export function readRecord(body: unknown): Bag {
  const bag = asBag(body);
  const data = bag['data'];
  return data && typeof data === 'object' && !Array.isArray(data) ? (data as Bag) : bag;
}

export function formatDate(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Explicit first: browser Intl currency-symbol data is locale-dependent and often has no
// mapping for less-common codes like NGN, silently printing "NGN" instead of "₦", this map
// covers the currencies this app actually assigns (see CURRENCY_CODE_BY_COUNTRY in auth.service).
const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = {
  NGN: '₦',
  USD: '$',
  GBP: '£',
  EUR: '€',
  GHS: '₵',
  KES: 'KSh',
  ZAR: 'R',
  XOF: 'CFA',
  XAF: 'FCFA',
  XCD: 'EC$',
  CZK: 'Kč',
  CDF: 'FC',
  TRY: '₺',
};

export function currencySymbol(code: string | null | undefined): string {
  const normalized = (code ?? 'NGN').toUpperCase();
  if (CURRENCY_SYMBOLS[normalized]) return CURRENCY_SYMBOLS[normalized];
  try {
    const part = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: normalized,
      currencyDisplay: 'narrowSymbol',
    })
      .formatToParts(0)
      .find((p) => p.type === 'currency');
    // A currency Intl doesn't recognise formats as a plain literal, not a "currency" part,
    // that's the same "just prints the code" failure mode this map exists to avoid.
    if (part && part.value !== normalized) return part.value;
  } catch {
    // Unknown/malformed ISO code, fall through to the raw code below.
  }
  return normalized;
}

export function formatMoney(value: unknown, currencyCode = 'NGN'): string | null {
  const amount = typeof value === 'string' ? Number(value) : value;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  return `${currencySymbol(currencyCode)}${amount.toLocaleString('en-NG', { maximumFractionDigits: 2 })}`;
}
