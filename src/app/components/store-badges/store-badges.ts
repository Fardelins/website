import { Component, inject, input } from '@angular/core';
import { APP_DOWNLOAD_CONFIG } from '../../config/app-download.config';
import { AppPlatformService } from '../../services/app-platform.service';
import { HapticsService } from '../../services/haptics.service';

@Component({
  selector: 'app-store-badges',
  standalone: true,
  templateUrl: './store-badges.html',
  styleUrl: './store-badges.css',
})
export class StoreBadges {
  private readonly appPlatform = inject(AppPlatformService);
  private readonly haptics = inject(HapticsService);

  /** Force both badges for wide, store-comparison contexts. */
  readonly showAll = input(false);

  protected get stores() {
    return this.showAll()
      ? [APP_DOWNLOAD_CONFIG.stores.ios, APP_DOWNLOAD_CONFIG.stores.android]
      : this.appPlatform.visibleStores;
  }

  protected hrefFor(url: string): string {
    return url || APP_DOWNLOAD_CONFIG.route;
  }

  protected storeClicked(): void {
    this.haptics.light();
  }
}
