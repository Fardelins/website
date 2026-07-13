import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

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
    const hasBody = !['GET', 'HEAD'].includes(req.method);
    fetch(`${WORDPRESS_ORIGIN}${targetPath}`, {
      method: req.method,
      headers,
      body: hasBody && chunks.length ? Buffer.concat(chunks) : undefined,
    })
      .then(async (upstream) => {
        res.status(upstream.status);
        upstream.headers.forEach((value, key) => {
          if (!['content-encoding', 'transfer-encoding', 'connection', 'content-length'].includes(key)) {
            res.setHeader(key, value);
          }
        });
        res.send(Buffer.from(await upstream.arrayBuffer()));
      })
      .catch(next);
  });
  req.on('error', next);
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
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
