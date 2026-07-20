import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import compression from 'compression';
import express from 'express';
import { basename, extname, join, sep } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// Gzip/deflate every response the app serves (HTML, JSON proxied from
// WordPress, and any static asset not already precompressed).
app.use(compression());

/**
 * Baseline security headers applied to every response. These are conservative
 * defaults that don't depend on a CDN/reverse proxy being in front of the app;
 * if one exists, it can still override or extend them. A Content-Security-Policy
 * is intentionally omitted here — the app uses inline WebGL shaders and injected
 * WordPress markup, so a CSP needs to be authored deliberately rather than
 * guessed at.
 */
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

/**
 * Reverse-proxy WordPress paths to the headless WordPress origin.
 *
 * The app calls WordPress with same-origin relative paths (`/wp-json`,
 * `/wp-admin`, `/contact-form-config`) so there's no CORS to manage. When the
 * Angular app owns fardelins.com and WordPress lives elsewhere, set
 * `WORDPRESS_ORIGIN` to that origin (e.g. https://cms.fardelins.com) and this
 * proxy forwards those requests transparently — mirroring dev's proxy.conf.json.
 */
const WORDPRESS_ORIGIN = process.env['WORDPRESS_ORIGIN'] ?? 'https://fardelins.com';
const WP_PROXY_PREFIXES = ['/wp-json', '/wp-admin', '/contact-form-config'];
const WORDPRESS_JS_GATE_COOKIE = 'hc_js_gate=1';

app.use((req, res, next) => {
  const prefix = WP_PROXY_PREFIXES.find((p) => req.path === p || req.path.startsWith(`${p}/`));
  if (!prefix) return next();

  // The contact form config lives under /contact/ on WordPress (see proxy.conf.json).
  const targetPath =
    prefix === '/contact-form-config'
      ? req.originalUrl.replace('/contact-form-config', '/contact/')
      : req.originalUrl;

  const chunks: Buffer[] = [];
  req.on('data', (chunk) => chunks.push(chunk as Buffer));
  req.on('end', () => {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined || ['host', 'connection', 'content-length'].includes(key)) continue;
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }

    // The WordPress host protects wp-admin with a JavaScript cookie gate. A
    // proxied fetch cannot execute that challenge page, so identify this
    // trusted server-to-server request up front and let admin-ajax return JSON.
    if (prefix === '/wp-admin') {
      const cookies = headers.get('cookie') ?? '';
      if (!/(?:^|;\s*)hc_js_gate=/.test(cookies)) {
        headers.set('cookie', [cookies, WORDPRESS_JS_GATE_COOKIE].filter(Boolean).join('; '));
      }
    }

    const hasBody = !['GET', 'HEAD'].includes(req.method);
    fetch(`${WORDPRESS_ORIGIN}${targetPath}`, {
      method: req.method,
      headers,
      body: hasBody && chunks.length ? Buffer.concat(chunks) : undefined,
    })
      .then(async (upstream) => {
        res.status(upstream.status);
        upstream.headers.forEach((value, key) => {
          if (
            !['content-encoding', 'transfer-encoding', 'connection', 'content-length'].includes(key)
          ) {
            res.setHeader(key, value);
          }
        });
        res.send(Buffer.from(await upstream.arrayBuffer()));
      })
      .catch(next);
  });
  req.on('error', next);
});

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const ONE_DAY_SECONDS = 60 * 60 * 24;

/**
 * Serve static files from /browser with cache lifetimes matched to how each
 * asset is versioned:
 *
 * - Hashed JS/CSS bundles (and Angular's hashed `media/` assets) carry a
 *   content hash in the filename, so a new deploy always yields a new URL.
 *   These can be cached forever and served `immutable`.
 * - Unversioned metadata that must reflect the latest deploy immediately
 *   (sitemap, robots, HTML, and the service-worker manifest/scripts) is served
 *   `no-cache` so clients always revalidate before reuse.
 * - Everything else copied from /public is unversioned but replaceable — the
 *   favicon, social image, and section imagery. These get a short lifetime so a
 *   redeploy propagates within a day while still avoiding a fetch per request.
 */
function setStaticCacheHeaders(res: express.Response, filePath: string): void {
  const file = basename(filePath);
  const ext = extname(filePath).toLowerCase();
  const isHashedBundle =
    ((ext === '.js' || ext === '.css') && /-[A-Za-z0-9]{8,}\.\w+$/.test(file)) ||
    filePath.split(sep).includes('media');

  const neverCache =
    file === 'robots.txt' ||
    file === 'sitemap.xml' ||
    file === 'ngsw.json' ||
    file === 'ngsw-worker.js' ||
    file === 'safety-worker.js' ||
    ext === '.html';

  if (neverCache) {
    res.setHeader('Cache-Control', 'no-cache');
  } else if (isHashedBundle) {
    res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR_SECONDS}, immutable`);
  } else {
    res.setHeader('Cache-Control', `public, max-age=${ONE_DAY_SECONDS}, must-revalidate`);
  }
}

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    index: false,
    redirect: false,
    setHeaders: setStaticCacheHeaders,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
