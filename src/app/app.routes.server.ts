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
  // Auth-gated and auth routes read browser storage, so they can only render client-side.
  { path: 'app/**', renderMode: RenderMode.Client },
  { path: 'signup', renderMode: RenderMode.Client },
  { path: 'signup/verify', renderMode: RenderMode.Client },
  { path: 'signup/phone', renderMode: RenderMode.Client },
  { path: 'login', renderMode: RenderMode.Client },
  { path: 'forgot-password', renderMode: RenderMode.Client },
  { path: 'reset-password', renderMode: RenderMode.Client },
  { path: 'payment/verify-paystack', renderMode: RenderMode.Client },
  { path: 'u/:username', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];
