export interface Option {
  id: number;
  label: string;
}

export interface CourierRate {
  rateId: string;
  courierName: string;
  logoUrl: string | null;
  priceLabel: string;
  amount: number;
  deliveryWindow: string | null;
  rating: number | null;
  reviewCount: number | null;
}

/** Both halves of the upload response; the order sends only `id` (BE rejects id and link together), `link` is for previews. */
export interface ParcelImage {
  id: string;
  link: string;
}

export type ParcelType = 'perishable' | 'non_perishable';
export const MAX_PARCEL_IMAGES = 4;

export interface PackageStep {
  categoryId: number | null;
  sizeId: number | null;
  type: ParcelType | null;
  shortDescription: string;
  weight: number | null;
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
  instructions?: string;
}

/** Locality ids for a party's picked state and city, resolved from the page's option lists. */
export interface LocationIds {
  stateId: number | null;
  cityId: number | null;
}

/** `user` is door delivery, `office` is collection from a courier office (BE's delivery_type values). */
export type DeliveryType = 'user' | 'office';

export interface DeliveryOptions {
  deliveryType: DeliveryType;
  priority: boolean;
}

export interface SendDraft extends DeliveryOptions {
  parcel: PackageStep;
  pickup: PartyStep;
  dropoff: PartyStep;
  fromMe: boolean;
  rateId: string | null;
  paymentMedium: string;
}

/** What placing an order returns: a payment reference and, when the medium supports it, a URL to pay at. */
export interface OrderResult {
  reference: string | null;
  authorizationUrl: string | null;
}

export const PAYMENT_MEDIUMS = [
  { value: 'paystack', label: 'Paystack' },
  { value: 'card', label: 'Card' },
  { value: 'flutterwave', label: 'Flutterwave' },
  { value: 'squad', label: 'Squad' },
];

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
      type: null,
      shortDescription: '',
      weight: null,
      quantity: 1,
      worth: null,
      images: [],
    },
    pickup: party(),
    dropoff: { ...party(), instructions: '' },
    fromMe: true,
    deliveryType: 'user',
    priority: false,
    rateId: null,
    paymentMedium: 'paystack',
  };
}
