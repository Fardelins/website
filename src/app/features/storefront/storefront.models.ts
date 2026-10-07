export interface StorefrontLocation {
  id: string | null;
  address: string;
  cityId: number | null;
  stateId: number | null;
  countryId: number | null;
  latitude: number | null;
  longitude: number | null;
  zipCode: string | null;
}

export interface Storefront {
  id: string;
  name: string;
  email: string;
  phone: string;
  description: string | null;
  website: string | null;
  location: StorefrontLocation | null;
  preferredCourierIds: readonly string[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PreferredCourier {
  id: string;
  name: string;
  logoUrl: string | null;
  // rating/reviewCount come from /user/couriers; priceLabel and deliveryWindow are mock-only (a rate carries them, not a courier).
  rating?: number | null;
  reviewCount?: number | null;
  priceLabel?: string | null;
  deliveryWindow?: string | null;
}

export interface StorefrontLocationInput {
  address: string;
  city_id?: number;
  state_id?: number;
  country_id?: number;
  latitude?: number;
  longitude?: number;
  zip_code?: string;
}

export interface StorefrontInput {
  name: string;
  email: string;
  phone: string;
  description?: string;
  website?: string;
  location?: StorefrontLocationInput;
  preferred_courier_ids?: string[];
}
