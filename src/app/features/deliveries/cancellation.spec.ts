import { describe, expect, it } from 'vitest';
import {
  CUSTOMER_CANCEL_REASONS,
  cancelFailureMessage,
  cancelPolicy,
  cancelReasonLabel,
  readCancellation,
} from './cancellation';

describe('cancelPolicy', () => {
  it('lets an unpaid shipment be cancelled for free', () => {
    for (const status of ['awaiting_payment', 'pending']) {
      expect(cancelPolicy(status, false)).toMatchObject({
        stage: 'unpaid',
        action: 'yes',
        fineMayApply: false,
        refundsInFull: false,
      });
    }
  });

  it('refunds a paid shipment with no courier in full and without a fine', () => {
    expect(cancelPolicy('pending', true)).toMatchObject({
      stage: 'paid_unassigned',
      action: 'yes',
      fineMayApply: false,
      refundsInFull: true,
    });
  });

  it('sends assigned and in-transit shipments to support, with a fine possible', () => {
    expect(cancelPolicy('assigned', true)).toMatchObject({ action: 'support', fineMayApply: true });
    for (const status of ['picked_up', 'enroute', 'delivered']) {
      expect(cancelPolicy(status, true)).toMatchObject({ stage: 'in_transit', action: 'support' });
    }
  });

  it('offers nothing once a parcel is handed over or already cancelled', () => {
    expect(cancelPolicy('received', true).action).toBe('no');
    expect(cancelPolicy('completed', true).action).toBe('no');
    expect(cancelPolicy('canceled', true).action).toBe('no');
  });
});

describe('cancel reasons', () => {
  it('labels known codes and tidies unknown ones', () => {
    expect(cancelReasonLabel(CUSTOMER_CANCEL_REASONS[0].code)).toBe(
      CUSTOMER_CANCEL_REASONS[0].label,
    );
    expect(cancelReasonLabel('courier_no_show')).toBe('Courier no show');
    expect(cancelReasonLabel(null)).toBeNull();
  });
});

describe('readCancellation', () => {
  it('returns null when BE sends nothing about the cancellation', () => {
    expect(readCancellation({ status: 'canceled' })).toBeNull();
  });

  it('reads the reason, fine and refund state', () => {
    const info = readCancellation({
      cancellation: {
        reason_code: 'changed_mind',
        fine_amount: 500,
        fine_status: 'applied',
        refund: { status: 'processing', amount: 2100, currency: 'NGN' },
      },
    });
    expect(info?.reasonLabel).toBe('I changed my mind');
    expect(info?.fineLabel).toContain('500');
    expect(info?.fineWaived).toBe(false);
    expect(info?.refund?.state).toBe('processing');
    expect(info?.refund?.amountLabel).toContain('2,100');
  });

  it('maps refund.processed to completed and refund.failed to failed', () => {
    expect(readCancellation({ refund: { status: 'processed' } })?.refund?.state).toBe('completed');
    expect(readCancellation({ refund: { status: 'needs-attention' } })?.refund?.state).toBe(
      'failed',
    );
  });

  it('hides a waived or zero fine amount and flags the waiver', () => {
    const info = readCancellation({
      cancellation: { reason_code: 'other', fine_amount: 0, fine_status: 'waived' },
    });
    expect(info?.fineLabel).toBeNull();
    expect(info?.fineWaived).toBe(true);
  });
});

describe('cancelFailureMessage', () => {
  it('explains a 409 and keeps other failures generic', () => {
    expect(cancelFailureMessage(409)).toContain('contact support');
    expect(cancelFailureMessage(500)).toContain('try again');
    expect(cancelFailureMessage(null)).toContain('try again');
  });
});
