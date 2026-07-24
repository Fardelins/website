import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

// Origin of the headless WordPress backend (CMS). This is the browser-bundle
// constant; keep it in sync with WORDPRESS_ORIGIN in server.ts and proxy.conf.json.
export const WORDPRESS_ORIGIN = 'https://cms.fardelins.com';

/** Absolute URL for public, CORS-enabled WordPress REST reads. */
export function wordpressPublicUrl(path: string): string {
  return `${WORDPRESS_ORIGIN}${path}`;
}

/** Form/private URL: relative in the browser (proxied), absolute during SSR (no page origin). */
export function wordpressUrl(path: string, platformId: object): string {
  return (isPlatformBrowser(platformId) ? '' : WORDPRESS_ORIGIN) + path;
}

/** `wordpressUrl` bound to the current injection context's platform. */
export function injectWordpressUrl(): (path: string) => string {
  const platformId = inject(PLATFORM_ID);
  return (path: string) => wordpressUrl(path, platformId);
}
