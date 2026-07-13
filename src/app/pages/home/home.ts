import { Component, inject } from '@angular/core';
import { Hero } from '../../components/hero/hero';
import { LogoMarquee } from '../../components/logo-marquee/logo-marquee';
import { Audience } from '../../components/audience/audience';
import { Features } from '../../components/features/features';
import { About } from '../../components/about/about';
import { Journey } from '../../components/journey/journey';
import { SITE_NAME, SITE_URL, SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-home',
  imports: [Hero, LogoMarquee, Audience, Features, About, Journey],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly seo = inject(SeoService);

  constructor() {
    const description =
      'Fardelins is the delivery platform connecting customers, businesses, dispatchers, and couriers — with real-time tracking, smart dispatch, and reliable last-mile delivery.';
    this.seo.update({
      title: `${SITE_NAME} — Smarter Deliveries for Everyone`,
      description,
      path: '/',
      type: 'website',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: SITE_NAME,
          url: SITE_URL,
          logo: `${SITE_URL}/home/logo.svg`,
          sameAs: [
            'https://web.facebook.com/fardelinsng',
            'https://twitter.com/fardelins',
            'https://www.instagram.com/fardelins/',
            'https://www.linkedin.com/company/fardelins',
          ],
        },
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE_NAME,
          url: SITE_URL,
        },
      ],
    });
  }
}
