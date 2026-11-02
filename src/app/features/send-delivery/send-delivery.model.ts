import { parsePhoneNumberFromString } from 'libphonenumber-js';

export interface Option {
  id: number;
  label: string;
  dimensions?: string | null;
  weightRange?: string | null;
}

export interface CourierRate {
  rateId: string;
  courierName: string;
  logoUrl: string | null;
  /** The total charged: BE multiplies the rate by the parcel quantity. */
  priceLabel: string;
  amount: number;
  /** "₦2,600 × 3" when the quantity is above 1. */
  quantityNote?: string | null;
  deliveryWindow: string | null;
  rating: number | null;
  reviewCount: number | null;
  deliveriesMade: number | null;
}

/** Both halves of the upload response; the order sends only `id` (BE rejects id and link together), `link` is for previews. */
export interface ParcelImage {
  id: string;
  link: string;
}

export type ParcelType = 'breakable' | 'flammable' | 'perishable' | 'non_perishable';
export const MAX_PARCEL_IMAGES = 4;

/** BE's parcel.type takes only perishable | non_perishable (confirmed 2026-10-27). */
export function toBeParcelType(types: ParcelType[]): 'perishable' | 'non_perishable' {
  return types.includes('perishable') ? 'perishable' : 'non_perishable';
}

/** Breakable and flammable have no BE field yet, so they travel in the parcel's long_description. */
export function handlingNote(types: ParcelType[]): string | null {
  const flags = [
    types.includes('breakable') ? 'Breakable' : null,
    types.includes('flammable') ? 'Flammable' : null,
  ].filter((flag): flag is string => flag !== null);
  return flags.length ? `Handling: ${flags.join(', ')}` : null;
}

export interface PackageStep {
  categoryId: number | null;
  sizeId: number | null;
  types: ParcelType[];
  shortDescription: string;
  weight: number | null;
  customWeight?: boolean;
  quantity: number;
  worth: number | null;
  images: ParcelImage[];
}

export interface PartyStep {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  country: string;
  state: string;
  city: string;
  /** Set when the address was picked from Google; cleared as soon as it is edited by hand. */
  latitude?: number;
  longitude?: number;
  instructions?: string;
}

/** Locality ids for a party's picked state and city, resolved from the page's option lists. */
export interface LocationIds {
  stateId: number | null;
  cityId: number | null;
}

/** `user` is door delivery, `office` is collection from a courier office (BE's delivery_type values). */
export type DeliveryType = 'user' | 'office';

/** `user` is door pickup from the sender, `office` is the sender dropping it at a courier office (BE's pickup_type values). */
export type PickupType = 'user' | 'office';

export interface DeliveryOptions {
  pickupType: PickupType;
  deliveryType: DeliveryType;
  priority: boolean;
}

export interface SendDraft extends DeliveryOptions {
  parcel: PackageStep;
  pickup: PartyStep;
  dropoff: PartyStep;
  fromMe: boolean;
  rateId: string | null;
}

/** What placing an order returns: a payment reference and, when the medium supports it, a URL to pay at. */
export interface OrderResult {
  reference: string | null;
  authorizationUrl: string | null;
}

/** BE rejects local formats ("0815…") with "should be in international phone format"; Nigeria is the default country. */
export function toInternationalPhone(value: string): string {
  const compact = value.trim().replace(/[\s\-.()]/g, '');
  if (compact.startsWith('+')) return compact;
  if (compact.startsWith('00')) return `+${compact.slice(2)}`;
  if (/^234\d{10}$/.test(compact)) return `+${compact}`;
  if (/^0\d{10}$/.test(compact)) return `+234${compact.slice(1)}`;
  if (/^[789]\d{9}$/.test(compact)) return `+234${compact}`;
  return compact;
}

/** The number as BE wants it (+234…), or null when it is not a real number (wrong length, unknown prefix). */
export function normalizePhone(value: string): string | null {
  const parsed = parsePhoneNumberFromString(toInternationalPhone(value), 'NG');
  return parsed?.isValid() ? parsed.number : null;
}

export function isValidPhone(value: string): boolean {
  return normalizePhone(value) !== null;
}

export function emptyDraft(): SendDraft {
  const party = (): PartyStep => ({
    fullName: '',
    phone: '',
    email: '',
    address: '',
    country: 'Nigeria',
    state: '',
    city: '',
  });
  return {
    parcel: {
      categoryId: null,
      sizeId: null,
      types: ['non_perishable'],
      shortDescription: '',
      weight: null,
      customWeight: false,
      quantity: 1,
      worth: null,
      images: [],
    },
    pickup: party(),
    dropoff: { ...party(), instructions: '' },
    fromMe: true,
    pickupType: 'user',
    deliveryType: 'user',
    priority: false,
    rateId: null,
  };
}
