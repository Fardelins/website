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

app.disable('x-powered-by');
app.use(compression());

// Baseline security headers. CSP is intentionally omitted — inline WebGL shaders
// and injected WordPress markup mean it must be authored deliberately, not guessed.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// Reverse-proxy WordPress paths so the app can call them same-origin (no CORS).
// Set WORDPRESS_ORIGIN when WordPress lives off fardelins.com; mirrors proxy.conf.json.
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

    // wp-admin is behind a JS cookie gate a proxied fetch can't solve; set the
    // gate cookie up front so admin-ajax returns JSON instead of the challenge page.
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

// Cache hashed bundles forever (immutable), revalidate unversioned metadata
// (no-cache for sitemap/robots/HTML/service-worker), short TTL for the rest.
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

app.use(
  express.static(browserDistFolder, {
    index: false,
    redirect: false,
    setHeaders: setStaticCacheHeaders,
  }),
);

// Everything else is server-rendered by Angular.
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) => (response ? writeResponseToNodeResponse(response, res) : next()))
    .catch(next);
});

// Listen when run directly or under PM2 (pm_id).
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/** Request handler for the Angular CLI dev-server/build and serverless hosts. */
export const reqHandler = createNodeRequestHandler(app);
