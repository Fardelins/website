import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Static marketing/legal routes are prerendered to static HTML at build time.
 * The blog routes fetch live WordPress data per request, so they render on the
 * server on demand (SSR) — that's what puts real content + per-article OG tags
 * in the initial HTML for crawlers and social scrapers (and avoids baking a
 * stale/empty listing at build time).
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'contact', renderMode: RenderMode.Prerender },
  { path: 'terms', renderMode: RenderMode.Prerender },
  { path: 'privacy', renderMode: RenderMode.Prerender },
  { path: 'features', renderMode: RenderMode.Prerender },
  { path: 'download', renderMode: RenderMode.Prerender },
  { path: 'blogs', renderMode: RenderMode.Server },
  { path: 'blogs/:slug', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Server },
];
