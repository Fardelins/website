import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

// Origin of the WordPress backend. If it moves off fardelins.com, change this
// one value and the reverse-proxy rules in server.ts.
export const WORDPRESS_ORIGIN = 'https://fardelins.com';

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
