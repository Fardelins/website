// Generates public/sitemap.xml: static routes + one entry per WP blog post. If
// WordPress is unreachable, preserves blog URLs from the previous sitemap and
// fails loudly if there's none — SITEMAP_ALLOW_STATIC_ONLY=1 permits static-only.
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SITE_URL = 'https://fardelins.com';
const WP_POSTS = `${SITE_URL}/wp-json/wp/v2/posts?per_page=100&_fields=slug,modified`;
const OUT_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sitemap.xml');
const ALLOW_STATIC_ONLY = process.env.SITEMAP_ALLOW_STATIC_ONLY === '1';

const STATIC_ROUTES = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/blogs', changefreq: 'daily', priority: '0.9' },
  { loc: '/contact', changefreq: 'monthly', priority: '0.6' },
  { loc: '/features', changefreq: 'monthly', priority: '0.8' },
  { loc: '/download', changefreq: 'monthly', priority: '0.7' },
  { loc: '/terms', changefreq: 'yearly', priority: '0.3' },
  { loc: '/privacy', changefreq: 'yearly', priority: '0.3' },
];

async function fetchPosts() {
  const res = await fetch(WP_POSTS, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

/** Recover individual blog-post entries (/blogs/<slug>) from the previous sitemap. */
async function readCachedBlogEntries() {
  let xml;
  try {
    xml = await readFile(OUT_PATH, 'utf8');
  } catch {
    return [];
  }
  const entries = [];
  for (const block of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const body = block[1];
    const loc = body.match(/<loc>([^<]+)<\/loc>/)?.[1];
    if (!loc) continue;
    const rel = loc.startsWith(SITE_URL) ? loc.slice(SITE_URL.length) : loc;
    if (!/^\/blogs\/.+/.test(rel)) continue; // only individual posts, not /blogs
    entries.push({
      loc: rel,
      lastmod: body.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1],
      changefreq: body.match(/<changefreq>([^<]+)<\/changefreq>/)?.[1] ?? 'weekly',
      priority: body.match(/<priority>([^<]+)<\/priority>/)?.[1] ?? '0.8',
    });
  }
  return entries;
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  const parts = [`    <loc>${SITE_URL}${loc}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) parts.push(`    <priority>${priority}</priority>`);
  return `  <url>\n${parts.join('\n')}\n  </url>`;
}

async function resolveBlogEntries() {
  try {
    const posts = await fetchPosts();
    return posts
      .filter((p) => p?.slug)
      .map((p) => ({
        loc: `/blogs/${p.slug}`,
        lastmod: p.modified ? new Date(p.modified).toISOString() : undefined,
        changefreq: 'weekly',
        priority: '0.8',
      }));
  } catch (err) {
    const cached = await readCachedBlogEntries();
    if (cached.length > 0) {
      console.warn(
        `[sitemap] WordPress unreachable (${err.message}). Preserving ${cached.length} blog URL(s) from the previous sitemap.`,
      );
      return cached;
    }
    if (ALLOW_STATIC_ONLY) {
      console.warn(
        `[sitemap] WordPress unreachable (${err.message}) and no previous sitemap to preserve. ` +
          `SITEMAP_ALLOW_STATIC_ONLY=1 set — writing static routes only.`,
      );
      return [];
    }
    console.error(
      `[sitemap] FAILED: WordPress unreachable (${err.message}) and no previous sitemap to preserve. ` +
        `Refusing to ship a static-only sitemap that would drop every blog URL. ` +
        `Set SITEMAP_ALLOW_STATIC_ONLY=1 to override (first build / local dev).`,
    );
    process.exit(1);
  }
}

async function main() {
  const postEntries = await resolveBlogEntries();

  const urls = [...STATIC_ROUTES, ...postEntries].map(urlEntry).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  await writeFile(OUT_PATH, xml, 'utf8');
  console.log(
    `[sitemap] Wrote ${STATIC_ROUTES.length + postEntries.length} URLs to public/sitemap.xml`,
  );
}

main();
