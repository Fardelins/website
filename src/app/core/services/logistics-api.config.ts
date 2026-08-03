import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

// Same-origin in the browser (proxied), absolute during SSR. Mirrors WORDPRESS_ORIGIN / wordpressUrl.
export const LOGISTICS_API_ORIGIN = 'https://staging.fardelins.com';

export function logisticsApiUrl(path: string, platformId: object): string {
  return (isPlatformBrowser(platformId) ? '' : LOGISTICS_API_ORIGIN) + '/v1' + path;
}

/** `logisticsApiUrl` bound to the current injection context's platform. */
export function injectLogisticsApiUrl(): (path: string) => string {
  const platformId = inject(PLATFORM_ID);
  return (path: string) => logisticsApiUrl(path, platformId);
}
