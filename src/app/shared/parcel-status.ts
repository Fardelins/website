/** Shared visual status vocabulary. Raw API `delivered` means out for delivery, not hand-off. */
export const PARCEL_STATUSES = [
  { key: 'delivered', label: 'Delivered', token: '--parcel-status-delivered' },
  { key: 'transit', label: 'Shipped', token: '--parcel-status-transit' },
  { key: 'assigned', label: 'Assigned', token: '--parcel-status-assigned' },
  { key: 'pending', label: 'Pending', token: '--parcel-status-pending' },
  { key: 'cancelled', label: 'Cancelled', token: '--parcel-status-cancelled' },
] as const;
export type ParcelStatusGroup = (typeof PARCEL_STATUSES)[number]['key'];
export function parcelStatusGroup(status: string): ParcelStatusGroup {
  const key = normalizeStatus(status);
  if (['received', 'completed'].includes(key)) return 'delivered';
  if (['cancelled', 'canceled', 'failed'].includes(key)) return 'cancelled';
  if (key === 'assigned') return 'assigned';
  if (['pending', 'processing', 'awaiting_pickup'].includes(key)) return 'pending';
  if (
    [
      'picked_up',
      'enroute',
      'office',
      'at_office',
      'out_for_delivery',
      'delivered',
      'shipped',
      'in_transit',
    ].includes(key)
  )
    return 'transit';
  return 'pending';
}

/** Dashboard summaries collapse stationary stages without changing their visual status tones. */
export const DASHBOARD_PARCEL_STATUSES = PARCEL_STATUSES.filter(
  (status) => status.key !== 'assigned',
) as readonly Exclude<(typeof PARCEL_STATUSES)[number], { key: 'assigned' }>[];
export type DashboardParcelStatusGroup = (typeof DASHBOARD_PARCEL_STATUSES)[number]['key'];
export function dashboardParcelStatusGroup(status: string): DashboardParcelStatusGroup {
  const key = normalizeStatus(status);
  const tone = parcelStatusGroup(status);
  if (tone === 'assigned' || ['office', 'at_office'].includes(key)) return 'pending';
  return tone;
}

function normalizeStatus(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}
