import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { RESPONSE_INIT } from '@angular/core';
import { SITE_NAME, SeoService } from '@core/services/seo.service';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  templateUrl: './not-found.html',
  styleUrl: './not-found.css',
})
export class NotFound {
  private readonly seo = inject(SeoService);
  private readonly router = inject(Router);

  constructor() {
    const response = inject(RESPONSE_INIT, { optional: true });
    if (response) {
      response.status = 404;
      response.statusText = 'Not Found';
    }

    this.seo.update({
      title: `Page Not Found | ${SITE_NAME}`,
      description:
        'The page you requested could not be found. Please return to the homepage and try again.',
      path: this.router.url || '/404',
      robots: 'noindex, follow',
    });
  }
}
