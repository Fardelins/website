import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { solarCheckCircleBoldDuotone } from '@ng-icons/solar-icons/bold-duotone';
import { HapticsService } from '@core/services/haptics.service';
import { SITE_NAME, SeoService } from '@core/services/seo.service';
import { AppPromoService } from '@features/app-promo/app-promo.service';

// Reached only when there's no payment redirect: the mock session, or a payment medium with no
// authorization_url. A Paystack order comes back to /payment/verify-paystack instead.
@Component({
  selector: 'app-order-success',
  imports: [RouterLink, NgIcon],
  viewProviders: [provideIcons({ solarCheckCircleBoldDuotone })],
  templateUrl: './order-success.html',
  styleUrls: ['../../../../shared/styles/forms.css', './order-success.css'],
})
export class OrderSuccess {
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);

  // Order creation returns a payment reference, not a tracking id, so this can't deep-link to
  // a delivery detail page the way it used to.
  protected readonly reference = signal('');

  constructor() {
    const id = this.route.snapshot.paramMap.get('orderId') ?? '';
    this.reference.set(id === 'new' ? '' : id);
    this.seo.update({
      title: `Order placed | ${SITE_NAME}`,
      description: 'Your delivery has been booked.',
      path: '/app/send/success',
      robots: 'noindex, nofollow',
    });
    inject(HapticsService).success();
    inject(AppPromoService).request('order-success');
  }
}
