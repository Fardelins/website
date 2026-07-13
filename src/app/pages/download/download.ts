import { Component, inject } from '@angular/core';
import { APP_DOWNLOAD_CONFIG } from '../../config/app-download.config';
import { StoreBadges } from '../../components/store-badges/store-badges';
import { TiltDirective } from '../../directives/tilt.directive';
import { AppPlatformService } from '../../services/app-platform.service';
import { HapticsService } from '../../services/haptics.service';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-download',
  standalone: true,
  imports: [StoreBadges, TiltDirective],
  templateUrl: './download.html',
  styleUrl: './download.css',
})
export class Download {
  private readonly appPlatform = inject(AppPlatformService);
  private readonly haptics = inject(HapticsService);

  protected readonly preferredStore = this.appPlatform.preferredStore;
  protected readonly preferredHref = this.appPlatform.hrefFor();
  protected readonly hasLivePreferredLink = Boolean(this.preferredStore?.url);
  protected readonly platformMessage = this.preferredStore
    ? `We detected ${this.preferredStore.shortName}. Your download is ready below.`
    : 'Choose the store for your phone and keep every delivery close.';

  constructor() {
    inject(SeoService).update({
      title: 'Download the Fardelins App',
      description: 'Download Fardelins for iPhone or Android to book, track, and manage deliveries from your phone.',
      path: APP_DOWNLOAD_CONFIG.route,
    });
  }

  protected download(): void {
    this.haptics.light();
  }
}

