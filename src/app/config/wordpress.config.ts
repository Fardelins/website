import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Absolute origin of the WordPress backend (REST API + admin-ajax).
 *
 * The Angular app is served from fardelins.com (Railway). In the browser we call
 * WordPress with SAME-ORIGIN relative paths (`/wp-json`, `/wp-admin`) — the dev
 * server proxies these (see `proxy.conf.json`) and in production Railway must
 * reverse-proxy the same paths to WordPress. Keeping them same-origin also avoids
 * CORS on the newsletter POST.
 *
 * During server-side rendering there is no page origin, so data fetches need this
 * absolute URL instead. If WordPress ever moves off fardelins.com (e.g. to
 * `https://cms.fardelins.com`), change this ONE value and update the reverse-proxy
 * rules — nothing else.
 */
export const WORDPRESS_ORIGIN = 'https://fardelins.com';

/**
 * Builds a WordPress URL: relative in the browser (proxied / same-origin),
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
