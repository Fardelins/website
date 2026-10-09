import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { parseApiError } from '@core/auth/auth.models';
import { injectLogisticsApiUrl } from '@core/services/logistics-api.config';
import { ProfileService } from '@features/profile/profile.service';

export type PaymentOutcome = 'success' | 'pending' | 'failed';

type Bag = Record<string, unknown>;

const SUCCESS = new Set(['success', 'successful', 'paid', 'completed']);
const FAILED = new Set(['failed', 'abandoned', 'reversed', 'cancelled', 'canceled', 'declined']);

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = injectLogisticsApiUrl();
  private readonly profile = inject(ProfileService);

  /**
   * Asks BE for a Paystack payment's status. Throws when the check itself fails, which is not
   * the same as the payment failing.
   */
  async verifyPaystack(reference: string): Promise<PaymentOutcome> {
    try {
      const body = await firstValueFrom(
        this.http.get(this.apiUrl('/payment/verify-paystack'), { params: { reference } }),
      );
      return toOutcome(body);
    } catch (error) {
      // BE answers an unpaid reference with a 400 whose body says `abandoned`: Paystack saw no
      // completed payment. Any other failure is the check itself failing, not the payment.
      if (error instanceof HttpErrorResponse && error.status === 400) {
        const status = toOutcome({ status: asBag(error.error)['status'] });
        if (status === 'failed') return status;
      }
      const recorded = await this.fromTransactions(reference);
      if (recorded) return recorded;
      throw error;
    }
  }

  /** Restarts payment for an order that was created but never paid; returns the Paystack page to go to. */
  async resume(orderId: string): Promise<string> {
    let body: unknown;
    try {
      body = await firstValueFrom(
        this.http.get(
          this.apiUrl(
            `/customer-shipment/pending-payment-request/paystack/${encodeURIComponent(orderId)}`,
          ),
        ),
      );
    } catch (error) {
      throw new Error(parseApiError(error, "We couldn't restart that payment. Please try again."));
    }
    const data = asBag(asBag(body)['data'] ?? body);
    const url = data['authorization_url'];
    if (typeof url !== 'string' || !url) {
      throw new Error("We couldn't restart that payment. Please try again.");
    }
    return url;
  }

  private async fromTransactions(reference: string): Promise<PaymentOutcome | null> {
    try {
      const row = (await this.profile.transactions()).find((item) => item.reference === reference);
      return row ? toOutcome({ data: { status: row.status } }) : null;
    } catch {
      return null;
    }
  }
}

/**
 * The response has no schema yet. Paystack's own verify response nests the transaction status
 * at data.status, and BE may pass that through under its own data wrapper, so each level is
 * checked. Anything unrecognised reads as pending, never as paid.
 */
export function toOutcome(body: unknown): PaymentOutcome {
  const root = asBag(body);
  const data = asBag(root['data']);
  const candidates = [
    data['status'],
    asBag(data['data'])['status'],
    asBag(data['transaction'])['status'],
    asBag(data['payment'])['status'],
    root['status'],
  ];
  for (const value of candidates) {
    if (typeof value !== 'string') continue;
    const status = value.trim().toLowerCase();
    if (SUCCESS.has(status)) return 'success';
    if (FAILED.has(status)) return 'failed';
  }
  return 'pending';
}

function asBag(value: unknown): Bag {
  return value && typeof value === 'object' ? (value as Bag) : {};
}
