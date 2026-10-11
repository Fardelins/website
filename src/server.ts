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

// Baseline security headers. CSP is intentionally omitted, inline WebGL shaders
// and injected WordPress markup mean it must be authored deliberately, not guessed.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// Never relay edge/proxy routing metadata to another proxied origin. In
// particular, Cloudflare rejects a CF-Connecting-IP header received from an
// untrusted intermediary with Error 1000 ("DNS points to prohibited IP").
function upstreamHeaders(req: express.Request): Headers {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    const isRoutingHeader =
      key === 'forwarded' ||
      key === 'true-client-ip' ||
      key.startsWith('cf-') ||
      key.startsWith('x-forwarded-') ||
      key.startsWith('x-railway-');

    if (
      value === undefined ||
      isRoutingHeader ||
      ['host', 'connection', 'content-length', 'cdn-loop'].includes(key)
    ) {
      continue;
    }

    headers.set(key, Array.isArray(value) ? value.join(', ') : value);
  }

  return headers;
}

// Reverse-proxy WordPress paths so the app can call them same-origin (no CORS).
// Override with the WORDPRESS_ORIGIN env var if the CMS moves; mirrors proxy.conf.mjs.
const WORDPRESS_ORIGIN = process.env['WORDPRESS_ORIGIN'] ?? 'https://cms.fardelins.com';
const WP_PROXY_PREFIXES = ['/wp-json', '/wp-admin', '/contact-form-config'];
const WORDPRESS_JS_GATE_COOKIE = 'hc_js_gate=1';

app.use((req, res, next) => {
  const prefix = WP_PROXY_PREFIXES.find((p) => req.path === p || req.path.startsWith(`${p}/`));
  if (!prefix) return next();

  // The contact form config lives under /contact/ on WordPress (see proxy.conf.mjs).
  const targetPath =
    prefix === '/contact-form-config'
      ? req.originalUrl.replace('/contact-form-config', '/contact/')
      : req.originalUrl;

  const chunks: Buffer[] = [];
  req.on('data', (chunk) => chunks.push(chunk as Buffer));
  req.on('end', () => {
    const headers = upstreamHeaders(req);

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

// Reverse-proxy the logistics API so the browser calls tracking reads same-origin
// (no CORS). Override with TRACKING_API_ORIGIN if the API host moves; mirrors
// TRACKING_API_ORIGIN in tracking.config.ts and the /v1 entry in proxy.conf.mjs.
const TRACKING_API_ORIGIN = process.env['TRACKING_API_ORIGIN'] ?? 'https://staging.fardelins.com';

app.use((req, res, next) => {
  if (req.path !== '/v1' && !req.path.startsWith('/v1/')) return next();

  const chunks: Buffer[] = [];
  req.on('data', (chunk) => chunks.push(chunk as Buffer));
  req.on('end', () => {
    const headers = upstreamHeaders(req);

    const hasBody = !['GET', 'HEAD'].includes(req.method);
    fetch(`${TRACKING_API_ORIGIN}${req.originalUrl}`, {
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

// The browser Places key, read from a Railway variable at runtime so it is never in git or the bundle.
// It still reaches the browser (it must), so it needs referrer and API restrictions in Google Cloud.
app.get('/api/public-config', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({ googlePlacesKey: process.env['GOOGLE_PLACES_API_KEY'] ?? '' });
});

// Mailchimp subscribe, proxied server-side since the API key can't reach the browser.
// MAILCHIMP_AUDIENCE_ID is swappable independently of the key (different list, same key).
const MAILCHIMP_API_KEY = process.env['MAILCHIMP_API_KEY'];
const MAILCHIMP_AUDIENCE_ID = process.env['MAILCHIMP_AUDIENCE_ID'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/newsletter/subscribe', express.json(), async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ message: 'Please enter a valid email address.' });
    return;
  }
  if (!MAILCHIMP_API_KEY || !MAILCHIMP_AUDIENCE_ID) {
    res.status(500).json({ message: 'Newsletter signup is not configured.' });
    return;
  }

  // The API key's datacenter suffix (after the dash) picks the request host.
  const datacenter = MAILCHIMP_API_KEY.split('-').pop();
  const url = `https://${datacenter}.api.mailchimp.com/3.0/lists/${MAILCHIMP_AUDIENCE_ID}/members`;

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`anystring:${MAILCHIMP_API_KEY}`).toString('base64')}`,
      },
      body: JSON.stringify({ email_address: email, status: 'subscribed' }),
    });

    if (upstream.ok) {
      res.status(200).json({ status: 'subscribed' });
      return;
    }

    const body = (await upstream.json().catch(() => null)) as {
      title?: string;
      detail?: string;
    } | null;
    // Already on the list, tell the user rather than pretending it's a fresh signup.
    if (upstream.status === 400 && body?.title === 'Member Exists') {
      res.status(200).json({ status: 'already_subscribed' });
      return;
    }

    console.error('Mailchimp subscribe rejected:', upstream.status, body?.title, body?.detail);
    // Mailchimp's `detail` is written to be shown to the end user (e.g. "looks fake or invalid").
    res.status(400).json({ message: body?.detail || 'That email address was rejected.' });
  } catch (error) {
    console.error('Mailchimp subscribe request failed:', error);
    res.status(502).json({ message: "Couldn't reach the newsletter service. Please try again." });
  }
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
