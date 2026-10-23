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
  /** An object since 2026-10-20; the bare array is the old shape. */
  data: TrackingEventRaw[] | { transaction_status?: string | null; tracking?: TrackingEventRaw[] };
}

/** Payment status of the shipment's order; `unknown` covers any value BE adds later. */
export type PaymentStatus = 'pending' | 'success' | 'failed' | 'canceled' | 'unknown';

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
  /** True once the final phase is reached, the journey is finished, not in-progress. */
  delivered: boolean;
  /** True once a dispatcher is assigned (`assigned`), which completes the first step. */
  accepted: boolean;
  /** True only on the terminal `completed` status, which is what a receipt may be issued against. */
  completed: boolean;
  headline: string;
  updatedLabel: string;
  /** Null when the parcel has no order or payment yet. */
  paymentStatus: PaymentStatus | null;
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

// API status `delivered` actually means "out for delivery", `received` is the real hand-off.
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  picked_up: 'Picked up',
  enroute: 'Enroute',
  office: 'At office',
  delivered: 'Out for delivery',
  received: 'Received',
  completed: 'Completed',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
  failed: 'Failed',
};

/** The first step reads "Confirming" until a dispatcher is assigned (`assigned`). */
export function phaseLabel(phase: TrackingPhase, status: string | null | undefined): string {
  return phase.key === 'confirmed' && status === 'pending' ? 'Confirming' : phase.label;
}

export function phaseIndexForStatus(status: string): number {
  return TRACKING_PHASES.findIndex((phase) => phase.statuses.includes(status));
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
