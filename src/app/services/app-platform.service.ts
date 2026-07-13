import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { APP_DOWNLOAD_CONFIG, AppPlatform, AppStoreLink } from '../config/app-download.config';

@Injectable({ providedIn: 'root' })
export class AppPlatformService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly platform: AppPlatform = this.detectPlatform();

  get preferredStore(): AppStoreLink | null {
    if (this.platform === 'android' || this.platform === 'ios') {
      return APP_DOWNLOAD_CONFIG.stores[this.platform];
    }
    return null;
  }

  get visibleStores(): AppStoreLink[] {
    return this.preferredStore
      ? [this.preferredStore]
      : [APP_DOWNLOAD_CONFIG.stores.ios, APP_DOWNLOAD_CONFIG.stores.android];
  }

  hrefFor(store: AppStoreLink | null = this.preferredStore): string {
    return store?.url || APP_DOWNLOAD_CONFIG.route;
  }

  private detectPlatform(): AppPlatform {
    if (!this.isBrowser) return 'other';

    const userAgent = navigator.userAgent || '';
    if (/android/i.test(userAgent)) return 'android';

    const isAppleMobile = /iPad|iPhone|iPod/i.test(userAgent);
    const isModernIPad = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return isAppleMobile || isModernIPad ? 'ios' : 'other';
  }
}

