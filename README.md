# Fardelins

Fardelins is a modern Angular application for the brand at <https://fardelins.com/>. The site
showcases the company’s logistics-focused offering through a polished marketing experience —
hero, audience, features, company story, delivery journey, contact, a WordPress-backed blog,
an app-download page, and legal pages.

## Overview

The app is **server-side rendered (Angular SSR)**. Marketing and legal routes are prerendered
to static HTML at build time; the blog is rendered on the server per request so crawlers and
social scrapers receive real content and per-article metadata in the initial HTML.

Routes:

- Home
- Blog listing (`/blogs`) and articles (`/blogs/:slug`)
- Contact
- Download
- Terms of service
- Privacy policy

The blog content is pulled live from a **headless WordPress** backend via its REST API — posts,
categories, featured images, and article bodies are fetched and normalized at runtime.

## Tech stack

- Angular 22 (standalone components, signals) with **Angular SSR** (`@angular/ssr`, Express)
- TypeScript, RxJS; gzip/brotli response `compression` on the SSR server
- Headless WordPress REST API (blog + contact form) and Mailchimp via admin-ajax (newsletter)
- PWA: service worker (`@angular/service-worker`, `ngsw-config.json`)
- WebGPU hero background (Three.js via `shaders`, lazy-loaded); 3D tilt + `web-haptics` micro-interactions
- Self-hosted `woff2` fonts (`public/fonts`, `@font-face` in `src/styles.css`)
- `sharp` build-time image optimization (WebP), Vitest for unit tests

## Project structure

- `src/app/components` — reusable UI sections (hero, features, navbar, footer, blog cards, shaders)
- `src/app/pages` — page-level components (home, blogs, blog-detail, contact, download, terms, privacy)
- `src/app/services` — data + cross-cutting services (blog, newsletter, SEO, haptics, contact form)
- `src/app/config` — configuration constants (WordPress origin, app-download links)
- `src/app/directives` — custom directives (e.g. 3D tilt)
- `public` — static assets: images, icons, `robots.txt`, `sitemap.xml`, `og-image.png`
- `src/server.ts` — Express SSR entry (also reverse-proxies WordPress paths)
- `scripts` — build helpers: `generate-sitemap.mjs`, `optimize-images.mjs`, `selfhost-fonts.mjs`
- `railway.json` + `Dockerfile` — Railway deploy config (`npm run build` → SSR server)

## Getting started

1. Install dependencies (a repo `.npmrc` sets `legacy-peer-deps`):

   ```bash
   npm install
   ```

2. Start the dev server (proxies `/wp-json` and `/wp-admin` to WordPress):

   ```bash
   npm start
   ```

3. Open <http://localhost:4200/>. The app reloads on change.

## Build for production

```bash
npm run build
```

This runs a prebuild step that regenerates `public/sitemap.xml` from WordPress, then produces
the browser bundle, the server bundle, and prerenders the static routes into `dist/`.

## Run the SSR server

```bash
npm run serve:ssr:fardelins-app   # node dist/fardelins-app/server/server.mjs
```

The server listens on `$PORT` (default 4000).

## Server-side rendering & SEO

- Per-route `<title>`, meta description, canonical, Open Graph, Twitter cards, and JSON-LD are
  set by `SeoService` and rendered server-side.
- Structured data: Organization + WebSite (home), Blog (listing), BlogPosting + BreadcrumbList
  (articles), ContactPage + FAQPage (contact).
- `public/robots.txt` and `public/sitemap.xml` (regenerate anytime with `npm run generate:sitemap`).
- `prefers-reduced-motion` is respected across shader, tilt, marquee, and carousel animations.
- The WebGPU shader background (~360 KB) is skipped on data-saver, slow (2G), and low-memory
  (<4 GiB) devices; a static gradient fallback renders instead.

## Deployment (Railway)

`railway.json` is configured to build the Docker image and run the **SSR server** — deploy as
a Node service, not a static site:

- Build: `npm run build`
- Start: `npm run serve:ssr:fardelins-app`

Set these environment variables in Railway:

| Variable | Example | Purpose |
| --- | --- | --- |
| `NG_ALLOWED_HOSTS` | `fardelins.com,www.fardelins.com` | Allow-list for the SSR host-header check (`*` for local testing only). |
| `WORDPRESS_ORIGIN` | `https://cms.fardelins.com` | Origin of the headless WordPress backend. Defaults to `https://fardelins.com`. |

**WordPress domain:** public blog reads currently call `https://fardelins.com/wp-json` directly.
Newsletter and contact form requests use same-origin relative paths and the SSR server
reverse-proxies them to `WORDPRESS_ORIGIN`, avoiding browser CORS issues for POST requests. If
WordPress later moves to a dedicated origin, update both the public origin in
`wordpress.config.ts` and the Railway `WORDPRESS_ORIGIN` variable.

## Run tests

```bash
npm test
```

## Contact

For questions or updates related to the project, contact the Fardelins team through the website
contact page at <https://fardelins.com/contact>.
