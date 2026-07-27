# Fardelins

The production website for [Fardelins](https://fardelins.com), a logistics platform built for
customers, merchants, couriers, and dispatch teams.

This repository contains the public marketing experience, live shipment tracking, a
WordPress-powered blog, contact and newsletter integrations, app-download pages, and legal
content. It is built as an Angular server-rendered application and deployed to Railway as a
Dockerized Node service.

## Highlights

- Public shipment tracking with a real-time status timeline
- Marketing pages for Fardelins products and audiences
- Headless WordPress blog with article metadata and social previews
- Contact and newsletter forms routed through the SSR server
- Server-rendered SEO metadata, canonical URLs, Open Graph tags, and JSON-LD
- Progressive Web App support with an Angular service worker
- Responsive motion, haptics, 3D tilt, and a lazy-loaded WebGPU background
- Self-hosted fonts and optimized WebP/AVIF assets

## Routes

| Route                | Purpose                                |
| -------------------- | -------------------------------------- |
| `/`                  | Marketing home page                    |
| `/features`          | Product and logistics feature overview |
| `/track`             | Shipment tracking form                 |
| `/track/:trackingId` | Direct link to a shipment timeline     |
| `/blogs`             | Published article listing              |
| `/blogs/:slug`       | Server-rendered blog article           |
| `/contact`           | Contact form and support information   |
| `/download`          | Mobile app download page               |
| `/terms`             | Terms of service                       |
| `/privacy`           | Privacy policy                         |

Unknown routes render the custom not-found page.

## How the application works

The application uses Angular SSR with an Express server:

- The home, marketing, legal, contact, download, and tracking experiences are delivered through
  the Angular application.
- Static routes are prerendered during the production build.
- Blog pages are rendered on demand so crawlers and link previews receive article content and
  metadata in the initial HTML.
- Express serves the built application, applies security and cache headers, and proxies requests
  that should remain same-origin in the browser.

### External request flow

```text
Public blog reads
Browser ──> cms.fardelins.com/wp-json/*

Contact and newsletter requests
Browser ──> fardelins.com/wp-admin/* or form path
        └──> Express SSR proxy ──> WORDPRESS_ORIGIN

Public shipment tracking
Browser ──> fardelins.com/v1/*
        └──> Express SSR proxy ──> TRACKING_API_ORIGIN
```

The same-origin proxies avoid browser CORS failures. Before calling another Cloudflare-backed
origin, the Express server removes Cloudflare, Railway, and forwarded routing headers. Relaying
headers such as `CF-Connecting-IP` from an intermediary can cause Cloudflare Error 1000.

## Technology

- Angular 22 with standalone components, signals, lazy routes, and Angular SSR
- TypeScript 6 and RxJS
- Express 5 with response compression and reverse proxies
- Headless WordPress REST API
- Angular service worker for PWA behavior
- Vitest through Angular's unit-test builder
- `sharp` for build-time image optimization
- `shaders`, Motion, and `web-haptics` for interactive presentation
- Docker and Railway for production deployment

## Project structure

```text
src/
├── app/
│   ├── core/       App-wide configuration and singleton services
│   ├── features/   Home, features, tracking, blog, contact, download, and legal domains
│   ├── layout/     Navbar, footer, consent banner, and app-download prompt
│   └── shared/     Reusable components and directives
├── server.ts       Express SSR server, static delivery, headers, and upstream proxies
└── styles.css      Global styles, tokens, and self-hosted font declarations

public/             Static images, fonts, icons, manifest, robots.txt, and sitemap.xml
scripts/            Sitemap, font, and image build utilities
Dockerfile          Multi-stage production image
railway.json        Railway build and runtime configuration
proxy.conf.json     Local-development proxy configuration
```

Cross-domain imports use the aliases `@core/*`, `@features/*`, and `@shared/*`. Imports within a
feature generally remain relative.

## Local development

### Prerequisites

- Node.js `>=22.22.3 <23`
- npm 10

The repository's `.npmrc` enables legacy peer-dependency resolution.

### Install and start

```bash
npm install
npm start
```

Open <http://localhost:4200>. The development server reloads when source files change and uses
`proxy.conf.json` for WordPress, form, newsletter, and tracking API requests.

## Available commands

| Command                           | Purpose                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `npm start`                       | Start the Angular development server with local proxies                         |
| `npm run build`                   | Generate the sitemap, build browser/server bundles, and prerender static routes |
| `npm run serve:ssr:fardelins-app` | Run the built Express SSR server                                                |
| `npm run test`                    | Run unit tests in watch mode                                                    |
| `npm run test:ci`                 | Run unit tests once                                                             |
| `npm run lint`                    | Check TypeScript, HTML, CSS, and scripts with Prettier                          |
| `npm run format`                  | Format TypeScript, HTML, CSS, and scripts                                       |
| `npm run generate:sitemap`        | Regenerate `public/sitemap.xml` from WordPress posts                            |
| `npm run optimize:images`         | Generate optimized image assets                                                 |
| `npm run generate:fonts`          | Generate local font assets                                                      |

## Production build

```bash
npm run build
npm run serve:ssr:fardelins-app
```

The build produces browser and server bundles under `dist/fardelins-app`. The SSR server listens
on `PORT`, defaulting to `4000` when the variable is absent.

## Deploying to Railway

Railway builds the multi-stage `Dockerfile` and starts the Angular SSR server. Deploy this
repository as a Node service, not as a static site.

### Environment variables

| Variable              | Requirement | Recommended value                 | Purpose                                                                   |
| --------------------- | ----------- | --------------------------------- | ------------------------------------------------------------------------- |
| `NG_ALLOWED_HOSTS`    | Required    | `fardelins.com,www.fardelins.com` | Allows Angular SSR to accept requests for the production domains          |
| `WORDPRESS_ORIGIN`    | Recommended | `https://cms.fardelins.com`       | Overrides the WordPress origin used by the runtime SSR proxy              |
| `TRACKING_API_ORIGIN` | Recommended | `https://staging.fardelins.com`   | Overrides the logistics API origin used by the `/v1` SSR proxy            |
| `PUBLIC_SITE_URL`     | Optional    | `https://fardelins.com`           | Sets canonical, Open Graph, and sitemap URLs when the public host differs |

`WORDPRESS_ORIGIN`, `TRACKING_API_ORIGIN`, and `PUBLIC_SITE_URL` should be origins without a
trailing slash. Do not add an API key for public shipment tracking; the endpoint is intentionally
public.

The application has safe default origins, but explicitly setting the upstream values in Railway
makes the active production configuration visible and easier to change.

### Domain responsibilities

- `fardelins.com` serves the Angular SSR application.
- `cms.fardelins.com` serves headless WordPress.
- `staging.fardelins.com` currently serves the logistics tracking API.

If an upstream domain moves, update all environments that reference it:

- WordPress: `WORDPRESS_ORIGIN` in Railway, `src/app/core/config/wordpress.config.ts`, and
  `proxy.conf.json`.
- Tracking: `TRACKING_API_ORIGIN` in Railway, `src/app/features/tracking/tracking.config.ts`, and
  `proxy.conf.json`.

## SEO and performance

- Route-specific titles, descriptions, canonical URLs, Open Graph tags, Twitter cards, and
  structured data are rendered by `SeoService`.
- Structured data covers the organization, website, blog, articles, breadcrumbs, contact page,
  and FAQs.
- `public/robots.txt` and `public/sitemap.xml` provide crawler discovery.
- Hashed bundles and media receive long-lived cache headers; HTML and service-worker metadata are
  revalidated.
- Reduced-motion, data-saver, slow-network, and low-memory preferences disable expensive visual
  effects when appropriate.

## Troubleshooting shipment tracking

The browser calling a URL such as
`https://fardelins.com/v1/public/track-shipment/FDL-1428746982311` is expected. `/v1` is a
same-origin route handled by the Express proxy, not the final logistics API host.

If production tracking returns `403 Forbidden`:

1. Inspect the response body, not only the status code.
2. Confirm Railway has the intended `TRACKING_API_ORIGIN` without a trailing slash.
3. Call the corresponding upstream URL directly and confirm it returns shipment data.
4. Check that the deployed `src/server.ts` removes `cf-*`, `x-forwarded-*`, `x-railway-*`,
   `Forwarded`, and `CDN-Loop` headers before contacting the upstream.
5. Redeploy Railway after changing server code or environment variables.

A Cloudflare page containing `Error 1000` or “DNS points to prohibited IP” indicates an edge
routing/proxy-header problem. It does not mean the shipment needs an API key or that the tracking
number is unauthorized.

## Contact

For product or support enquiries, use the [Fardelins contact page](https://fardelins.com/contact).
