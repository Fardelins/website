import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarCheckCircleBoldDuotone,
  solarClockCircleBoldDuotone,
  solarDangerCircleBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { HapticsService } from '@core/services/haptics.service';
import { SITE_NAME, SeoService } from '@core/services/seo.service';
import { PaymentService } from '../../payment.service';

/** `error` is the status check failing, not the payment: the copy must never say it failed. */
type State = 'checking' | 'success' | 'pending' | 'failed' | 'error' | 'missing';

const COPY: Record<Exclude<State, 'checking'>, { headline: string; description: string }> = {
  success: {
    headline: 'Payment received',
    description:
      "Your delivery is booked. We've emailed you the details, and you can follow it from My parcels.",
  },
  pending: {
    headline: 'Confirming your payment',
    description:
      "Paystack hasn't confirmed this payment yet. That usually takes a moment; check again shortly, or find it in My parcels once it clears.",
  },
  failed: {
    headline: "Payment didn't go through",
    description:
      "We couldn't confirm this payment. If you weren't charged, you can finish paying from the parcel in My parcels. If you were, it will show up there shortly.",
  },
  error: {
    headline: "We couldn't check this payment",
    description:
      "This doesn't mean it failed. Check again in a moment, and if you were charged it will still show up in My parcels.",
  },
  missing: {
    headline: 'No payment to check',
    description:
      "This page needs a payment reference from Paystack, and this link doesn't have one.",
  },
};

/**
 * Where Paystack sends the customer back after paying (Paystack appends `reference` and
 * `trxref`, the same value). It only reports status; BE settles the payment by webhook.
 */
@Component({
  selector: 'app-payment-return',
  imports: [RouterLink, NgIcon],
  viewProviders: [
    provideIcons({
      solarCheckCircleBoldDuotone,
      solarClockCircleBoldDuotone,
      solarDangerCircleBoldDuotone,
    }),
  ],
  templateUrl: './payment-return.html',
  styleUrl: './payment-return.css',
})
export class PaymentReturn {
  private readonly payments = inject(PaymentService);
  private readonly haptics = inject(HapticsService);

  protected readonly reference = (() => {
    const params = inject(ActivatedRoute).snapshot.queryParamMap;
    return (params.get('reference') ?? params.get('trxref') ?? '').trim();
  })();
  protected readonly state = signal<State>(this.reference ? 'checking' : 'missing');
  protected readonly copy = computed(() => {
    const state = this.state();
    return state === 'checking' ? null : COPY[state];
  });
  protected readonly icon = computed(() => {
    switch (this.state()) {
      case 'success':
        return 'solarCheckCircleBoldDuotone';
      case 'pending':
      case 'checking':
      case 'error':
        return 'solarClockCircleBoldDuotone';
      default:
        return 'solarDangerCircleBoldDuotone';
    }
  });

  constructor() {
    inject(SeoService).update({
      title: `Payment | ${SITE_NAME}`,
      description: 'Checking your Fardelins delivery payment.',
      path: '/payment/verify-paystack',
      robots: 'noindex, nofollow',
    });
    if (this.reference) void this.check();
  }

  protected async check(): Promise<void> {
    this.state.set('checking');
    try {
      const outcome = await this.payments.verifyPaystack(this.reference);
      this.state.set(outcome);
      if (outcome === 'success') this.haptics.success();
      else if (outcome === 'failed') this.haptics.error();
    } catch {
      this.state.set('error');
    }
  }

  protected recheck(): void {
    this.haptics.selection();
    void this.check();
  }
}
