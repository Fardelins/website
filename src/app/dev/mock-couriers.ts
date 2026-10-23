export interface MockCourier {
  id: string;
  name: string;
  logoUrl: string | null;
  rateId: string;
  amount: number;
  deliveryWindow: string;
  rating: number;
  reviewCount: number;
  deliveriesMade: number;
}

const courier = (
  slug: string,
  name: string,
  amount: number,
  deliveryWindow: string,
  rating: number,
  reviewCount: number,
  deliveriesMade: number,
): MockCourier => ({
  id: `demo-courier-${slug}`,
  name,
  logoUrl: null,
  rateId: `demo-rate-${slug}`,
  amount,
  deliveryWindow,
  rating,
  reviewCount,
  deliveriesMade,
});

/** Shared courier identities for development-account reviews across Settings and Send Parcel. */
export const MOCK_COURIERS: readonly MockCourier[] = [
  courier('kwik', 'Kwik Delivery', 3850, '1 day', 4.8, 312, 1840),
  courier('gig', 'GIG Logistics', 4650, '2 days', 4.7, 428, 2310),
  courier('sendbox', 'Sendbox', 3200, '2 - 3 days', 4.6, 196, 980),
  courier('topship', 'Topship', 5200, '2 days', 4.9, 154, 760),
  courier('red-star', 'Red Star Express', 4100, '2 - 3 days', 4.5, 238, 1204),
  courier('courierplus', 'CourierPlus', 3600, '2 - 3 days', 4.6, 187, 865),
  courier('dhl', 'DHL Express', 6800, '2 - 3 days', 4.8, 521, 5120),
  courier('fedex', 'FedEx', 7200, '2 - 3 days', 4.7, 403, 4388),
  courier('guo', 'GUO Logistics', 3450, '3 - 4 days', 4.4, 276, 1530),
  courier('abc', 'ABC Cargo Express', 3900, '3 - 4 days', 4.3, 143, 702),
  courier('urban-air', 'Urban Air Express Logistics', 3400, '2 - 3 days', 4.6, 256, 254),
  courier('air-logic', 'Air Logic Air Logistics', 4000, '2 - 3 days', 4.6, 256, 254),
  courier('posthaste', 'PostHaste Logistics', 4000, '2 - 3 days', 4.6, 256, 254),
  courier('swift-route', 'Swift Route Express', 3750, '2 days', 4.5, 164, 640),
  courier('lagos-dispatch', 'Lagos Dispatch Co', 4300, '2 - 3 days', 4.2, 98, 415),
  courier('abuja-quickmove', 'Abuja Quickmove', 3500, '3 days', 4.4, 121, 530),
  courier('naija-cargo', 'Naija Cargo Link', 3300, '4 - 5 days', 4.1, 76, 298),
  courier('metro-parcel', 'Metro Parcel Express', 4450, '2 days', 4.7, 209, 1096),
  courier('eagle-wing', 'Eagle Wing Logistics', 5100, '2 days', 4.8, 167, 890),
  courier('blueline', 'BlueLine Couriers', 3650, '3 - 4 days', 4.3, 134, 577),
  courier('safehands', 'SafeHands Delivery', 4800, '3 days', 4.9, 88, 342),
  courier('rapid-arrow', 'Rapid Arrow Express', 4200, '2 - 3 days', 4.4, 305, 1470),
  courier('capital-city', 'Capital City Logistics', 3950, '3 - 5 days', 4.0, 57, 211),
  courier('harmattan', 'Harmattan Freight', 5600, '4 - 6 days', 4.2, 43, 168),
  courier('okada', 'Okada Express', 3550, '2 days', 4.3, 262, 1318),
];
