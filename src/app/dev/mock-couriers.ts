export interface MockCourier {
  id: string;
  name: string;
  logoUrl: string | null;
  rateId: string;
  amount: number;
  deliveryWindow: string;
  rating: number;
  reviewCount: number;
}

/** Shared courier identities for development-account reviews across Settings and Send Parcel. */
export const MOCK_COURIERS: readonly MockCourier[] = [
  {
    id: 'demo-courier-kwik',
    name: 'Kwik Delivery',
    logoUrl: null,
    rateId: 'demo-rate-kwik',
    amount: 3850,
    deliveryWindow: 'Same day',
    rating: 4.8,
    reviewCount: 312,
  },
  {
    id: 'demo-courier-gig',
    name: 'GIG Logistics',
    logoUrl: null,
    rateId: 'demo-rate-gig',
    amount: 4650,
    deliveryWindow: '1 to 2 business days',
    rating: 4.7,
    reviewCount: 428,
  },
  {
    id: 'demo-courier-sendbox',
    name: 'Sendbox',
    logoUrl: null,
    rateId: 'demo-rate-sendbox',
    amount: 3200,
    deliveryWindow: 'Next business day',
    rating: 4.6,
    reviewCount: 196,
  },
  {
    id: 'demo-courier-topship',
    name: 'Topship',
    logoUrl: null,
    rateId: 'demo-rate-topship',
    amount: 5200,
    deliveryWindow: 'Same day',
    rating: 4.9,
    reviewCount: 154,
  },
  {
    id: 'demo-courier-red-star',
    name: 'Red Star Express',
    logoUrl: null,
    rateId: 'demo-rate-red-star',
    amount: 4100,
    deliveryWindow: '1 to 2 business days',
    rating: 4.5,
    reviewCount: 238,
  },
  {
    id: 'demo-courier-courierplus',
    name: 'CourierPlus',
    logoUrl: null,
    rateId: 'demo-rate-courierplus',
    amount: 3600,
    deliveryWindow: 'Next business day',
    rating: 4.6,
    reviewCount: 187,
  },
  {
    id: 'demo-courier-dhl',
    name: 'DHL Express',
    logoUrl: null,
    rateId: 'demo-rate-dhl',
    amount: 6800,
    deliveryWindow: '1 to 3 business days',
    rating: 4.8,
    reviewCount: 521,
  },
  {
    id: 'demo-courier-fedex',
    name: 'FedEx',
    logoUrl: null,
    rateId: 'demo-rate-fedex',
    amount: 7200,
    deliveryWindow: '1 to 3 business days',
    rating: 4.7,
    reviewCount: 403,
  },
  {
    id: 'demo-courier-guo',
    name: 'GUO Logistics',
    logoUrl: null,
    rateId: 'demo-rate-guo',
    amount: 3450,
    deliveryWindow: 'Next business day',
    rating: 4.4,
    reviewCount: 276,
  },
  {
    id: 'demo-courier-abc',
    name: 'ABC Cargo Express',
    logoUrl: null,
    rateId: 'demo-rate-abc',
    amount: 3900,
    deliveryWindow: '1 to 2 business days',
    rating: 4.3,
    reviewCount: 143,
  },
];
