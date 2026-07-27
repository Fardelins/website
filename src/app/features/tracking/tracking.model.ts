/** Raw tracking event as returned by GET /v1/public/track-shipment/{id}. */
export interface TrackingEventRaw {
  id: string;
  description: string;
  status: string;
  location: string | null;
  order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TrackingApiResponse {
  message: string;
  code: number;
  data: TrackingEventRaw[];
}

/** One timeline event, shaped for the view. */
export interface TrackingEvent {
  id: string;
  description: string;
  status: string;
  statusLabel: string;
  location: string | null;
  order: number;
  dateLabel: string;
  timeLabel: string;
  phaseIndex: number;
}

export interface TrackingResult {
  trackingId: string;
  /** Newest event first, for the timeline. */
  events: TrackingEvent[];
  currentPhaseIndex: number;
  /** 0–1: how far the latest status sits within the current phase's sub-statuses. */
  currentPhaseProgress: number;
  /** True once the final phase is reached — the journey is finished, not in-progress. */
  delivered: boolean;
  /** True only on the terminal `completed` status, which is what a receipt may be issued against. */
  completed: boolean;
  headline: string;
  updatedLabel: string;
}

/** The 8 raw API statuses grouped into 4 customer-facing phases. */
export interface TrackingPhase {
  key: string;
  label: string;
  statuses: string[];
}

export const TRACKING_PHASES: TrackingPhase[] = [
  { key: 'confirmed', label: 'Confirmed', statuses: ['pending', 'assigned'] },
  { key: 'in_transit', label: 'In Transit', statuses: ['picked_up', 'enroute', 'office'] },
  { key: 'out_for_delivery', label: 'Out for Delivery', statuses: ['delivered'] },
  { key: 'delivered', label: 'Delivered', statuses: ['received', 'completed'] },
];

// API status `delivered` actually means "out for delivery" — `received` is the real hand-off.
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending pickup',
  assigned: 'Assigned to courier',
  picked_up: 'Picked up',
  enroute: 'En route to destination',
  office: 'At courier office',
  delivered: 'Out for delivery',
  received: 'Received by recipient',
  completed: 'Delivered',
};

export function phaseIndexForStatus(status: string): number {
  return TRACKING_PHASES.findIndex((phase) => phase.statuses.includes(status));
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
