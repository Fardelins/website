import { Component, inject } from '@angular/core';
import { HeroLiquidBackground } from '../../components/hero-liquid-background/hero-liquid-background';
import { StoreBadges } from '../../components/store-badges/store-badges';
import { APP_DOWNLOAD_CONFIG } from '../../config/app-download.config';
import { TiltDirective } from '../../directives/tilt.directive';
import { AppPlatformService } from '../../services/app-platform.service';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-download',
  standalone: true,
  imports: [HeroLiquidBackground, StoreBadges, TiltDirective],
  templateUrl: './download.html',
  styleUrl: './download.css',
})
export class Download {
  private readonly appPlatform = inject(AppPlatformService);

  protected readonly preferredStore = this.appPlatform.preferredStore;
  protected readonly storeLinksReady = Object.values(APP_DOWNLOAD_CONFIG.stores).some((store) =>
    Boolean(store.url),
  );
  protected readonly availabilityMessage = this.preferredStore
    ? this.preferredStore.url
      ? `Fardelins is available for ${this.preferredStore.shortName}.`
      : `Fardelins for ${this.preferredStore.shortName} is coming soon.`
    : this.storeLinksReady
      ? 'Choose the store for your phone.'
      : 'Fardelins is coming soon to the App Store and Google Play.';

  constructor() {
    inject(SeoService).update({
      title: 'Download the Fardelins App | iPhone and Android',
      description:
        'Download Fardelins for iPhone or Android to book, track, and manage deliveries from your phone.',
      path: APP_DOWNLOAD_CONFIG.route,
    });
  }
}
