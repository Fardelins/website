import { RenderMode, ServerRoute } from '@angular/ssr';

// Marketing/legal routes prerender at build time; blog routes use SSR so live
// WordPress content and per-article OG tags land in the initial HTML for crawlers.
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
