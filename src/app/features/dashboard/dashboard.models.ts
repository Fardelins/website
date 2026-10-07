import { DeliverySummary } from '@features/deliveries/deliveries.model';

export type DeliveredPeriod = 'this-week' | 'last-six-months' | 'this-year' | 'all-time';
export type ActivityRange =
  'this-week' | 'this-month' | 'last-month' | 'last-6-months' | 'this-year';
import { DashboardParcelStatusGroup } from '@shared/parcel-status';
export type { DashboardParcelStatusGroup } from '@shared/parcel-status';

export interface MetricTrend {
  direction: 'up' | 'down';
  percent: number;
}

export interface StatusSegment {
  key: DashboardParcelStatusGroup;
  label: string;
  count: number;
  percent: number;
}

/** The delivered card's split bar: every parcel lands in exactly one segment. */
export interface MetricBreakdown {
  segments: StatusSegment[];
  total: number;
  caption: string;
}

export interface DashboardMetric {
  key: 'in-transit' | 'delivered' | 'total' | 'spend';
  label: string;
  value: number;
  displayValue: string;
  icon: string;
  /** Null when there's no prior period to measure against, never a fabricated 0%. */
  trend: MetricTrend | null;
  /** One quiet supporting line. Null when there's nothing true to say. */
  caption: string | null;
  breakdown: MetricBreakdown | null;
}

export interface DashboardActivityPoint {
  label: string;
  tooltipLabel: string;
  total: number;
  pending: number;
  transit: number;
  delivered: number;
  cancelled: number;
}

export type DashboardActivity = Record<ActivityRange, DashboardActivityPoint[]>;

export interface ActiveDeliveryCardData {
  orderDate?: string;
  trackingId: string;
  title: string;
  recipientName: string;
  destination: string;
  etaLabel: string;
  status: string;
  phaseIndex: number;
}

export interface SenderDashboardData {
  isEmpty: boolean;
  metrics: DashboardMetric[];
  activity: DashboardActivity;
  activeDeliveries: ActiveDeliveryCardData[];
  recentParcels: DeliverySummary[];
}
