import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Absolute origin of the WordPress backend (REST API + admin-ajax).
 *
 * Public REST reads can go directly to this origin because WordPress exposes
 * CORS-enabled GET endpoints. Mutating form requests still use same-origin
 * relative paths and the Express proxy so cookies, anti-spam checks, and form
 * tokens remain reliable.
 *
 * During server-side rendering there is no page origin, so data fetches need this
 * absolute URL instead. If WordPress ever moves off fardelins.com (e.g. to
 * `https://cms.fardelins.com`), change this ONE value and update the reverse-proxy
 * rules — nothing else.
 */
export const WORDPRESS_ORIGIN = 'https://fardelins.com';

/** Builds an absolute URL for public, CORS-enabled WordPress REST reads. */
export function wordpressPublicUrl(path: string): string {
  return `${WORDPRESS_ORIGIN}${path}`;
}

/**
 * Builds a private/form URL: relative in the browser (proxied / same-origin),
 * absolute during SSR. Inject `PLATFORM_ID` at the call site and pass it in.
 */
export function wordpressUrl(path: string, platformId: object): string {
  return (isPlatformBrowser(platformId) ? '' : WORDPRESS_ORIGIN) + path;
}

/** Convenience for use inside an injection context. */
export function injectWordpressUrl(): (path: string) => string {
  const platformId = inject(PLATFORM_ID);
  return (path: string) => wordpressUrl(path, platformId);
}
