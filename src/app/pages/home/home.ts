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
      'Fardelins connects customers, businesses, dispatchers, and couriers with real-time tracking, smart dispatch, and reliable last-mile delivery.';
    this.seo.update({
      title: `${SITE_NAME} | Smarter Delivery Management`,
      description,
      path: '/',
      type: 'website',
      // LCP element — mirror the hero's AVIF <source> so the browser can start
      // the fetch from the prerendered HTML before Angular hydrates.
      preloadImage: {
        href: '/home/phone-image-800.avif',
        imagesrcset:
          '/home/phone-image-480.avif 480w, /home/phone-image-800.avif 800w, /home/phone-image-1200.avif 1200w',
        imagesizes: '(max-width: 640px) 82vw, 400px',
        type: 'image/avif',
      },
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
