import { parcelStatusGroup } from '@shared/parcel-status';
import { asBag, formatMoney, readString } from './deliveries.model';

/** Flip once BE accepts a customer cancel after a courier is assigned (it 409s past `pending` today). */
export const BE_CANCELS_AFTER_ASSIGN = false;

/** Set to the customer cancel POST route once BE publishes it; until then the PATCH status call is used. */
export const CANCEL_POST_PATH: ((shipmentId: string) => string) | null = null;

export type CancelStage = 'unpaid' | 'paid_unassigned' | 'assigned' | 'in_transit' | 'delivered';

/** `yes` cancels in the app, `support` goes through super-admin approval, `no` offers nothing. */
export interface CancelPolicy {
  stage: CancelStage | null;
  action: 'yes' | 'support' | 'no';
  fineMayApply: boolean;
  refundsInFull: boolean;
}

const NO_CANCEL: CancelPolicy = {
  stage: null,
  action: 'no',
  fineMayApply: false,
  refundsInFull: false,
};

// "Assigned" and "picked up" follow the status groups in shared/parcel-status.ts (design doc Q4 is open).
export function cancelPolicy(rawStatus: string, paid: boolean): CancelPolicy {
  const key = rawStatus
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (key === 'awaiting_payment') {
    return { stage: 'unpaid', action: 'yes', fineMayApply: false, refundsInFull: false };
  }
  switch (parcelStatusGroup(rawStatus)) {
    case 'pending':
      return paid
        ? { stage: 'paid_unassigned', action: 'yes', fineMayApply: false, refundsInFull: true }
        : { stage: 'unpaid', action: 'yes', fineMayApply: false, refundsInFull: false };
    case 'assigned':
      return {
        stage: 'assigned',
        action: BE_CANCELS_AFTER_ASSIGN ? 'yes' : 'support',
        fineMayApply: true,
        refundsInFull: true,
      };
    case 'transit':
      return { stage: 'in_transit', action: 'support', fineMayApply: true, refundsInFull: true };
    case 'delivered':
      return { stage: 'delivered', action: 'no', fineMayApply: false, refundsInFull: false };
    default:
      return NO_CANCEL;
  }
}

export interface CancelReason {
  code: string;
  label: string;
}

/** Provisional until BE publishes the fixed list of customer reason codes. */
export const CUSTOMER_CANCEL_REASONS: readonly CancelReason[] = [
  { code: 'changed_mind', label: 'I changed my mind' },
  { code: 'wrong_details', label: 'I entered the wrong details' },
  { code: 'found_alternative', label: 'I found another option' },
  { code: 'price_too_high', label: 'The price is too high' },
  { code: 'courier_delay', label: 'The courier is taking too long' },
  { code: 'other', label: 'Something else' },
];

export const CANCEL_NOTE_MAX = 300;

export interface CancelRequest {
  reasonCode: string;
  note: string;
}

export function cancelReasonLabel(code: string | null): string | null {
  if (!code) return null;
  const known = CUSTOMER_CANCEL_REASONS.find((reason) => reason.code === code);
  if (known) return known.label;
  const words = code.replace(/_/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : null;
}

export type RefundState = 'processing' | 'completed' | 'failed';

export interface CancellationInfo {
  reasonLabel: string | null;
  fineLabel: string | null;
  fineWaived: boolean;
  refund: { state: RefundState; amountLabel: string | null } | null;
}

export const REFUND_COPY: Record<RefundState, { title: string; body: string }> = {
  processing: {
    title: 'Refund processing',
    body: 'Your refund is on its way. It can take up to 10 business days to reach your account.',
  },
  completed: {
    title: 'Refunded',
    body: 'The refund went back to the payment method you used.',
  },
  failed: {
    title: 'Refund needs attention',
    body: "The refund didn't go through. Support has been alerted and will retry it.",
  },
};

function refundState(status: string | null): RefundState | null {
  switch (status?.toLowerCase().replace(/[\s_-]+/g, '')) {
    case 'pending':
    case 'processing':
      return 'processing';
    case 'processed':
    case 'completed':
    case 'success':
      return 'completed';
    case 'failed':
    case 'needsattention':
      return 'failed';
    default:
      return null;
  }
}

/** Field names follow BE's design doc (reason_code, fine_amount, fine_status, refund.status); none are in Swagger yet. */
export function readCancellation(record: Record<string, unknown>): CancellationInfo | null {
  const cancellation = asBag(record['cancellation']);
  const refund = asBag(cancellation['refund'] ?? record['refund']);
  const state = refundState(readString(refund, ['status']));
  const fineAmount = Number(cancellation['fine_amount']);
  const fineStatus = readString(cancellation, ['fine_status']);
  const currency = readString(refund, ['currency']) ?? readString(record, ['currency']);
  const reasonLabel = cancelReasonLabel(readString(cancellation, ['reason_code', 'reason']));
  const fineLabel =
    Number.isFinite(fineAmount) && fineAmount > 0 && fineStatus !== 'none'
      ? formatMoney(fineAmount, currency ?? undefined)
      : null;
  const refundAmount = Number(refund['amount']);
  const info: CancellationInfo = {
    reasonLabel,
    fineLabel,
    fineWaived: fineStatus === 'waived',
    refund: state
      ? {
          state,
          amountLabel:
            Number.isFinite(refundAmount) && refundAmount > 0
              ? formatMoney(refundAmount, currency ?? undefined)
              : null,
        }
      : null,
  };
  return info.reasonLabel || info.fineLabel || info.refund ? info : null;
}

/** BE answers 409 when the shipment is already cancelled or past the stage it can cancel. */
export function cancelFailureMessage(status: number | null): string {
  return status === 409
    ? "This shipment can't be cancelled here any more, because a courier has already picked it up. Please contact support."
    : "We couldn't cancel this shipment. Please try again.";
}
