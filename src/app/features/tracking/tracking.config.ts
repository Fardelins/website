import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

// Same-origin in the browser (proxied), absolute during SSR. Mirrors WORDPRESS_ORIGIN / wordpressUrl.
export const TRACKING_API_ORIGIN = 'https://staging.fardelins.com';

export function trackingApiUrl(path: string, platformId: object): string {
  return (isPlatformBrowser(platformId) ? '' : TRACKING_API_ORIGIN) + '/v1' + path;
}

/** `trackingApiUrl` bound to the current injection context's platform. */
export function injectTrackingApiUrl(): (path: string) => string {
  const platformId = inject(PLATFORM_ID);
  return (path: string) => trackingApiUrl(path, platformId);
}
