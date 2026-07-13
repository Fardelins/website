// Generates public/sitemap.xml: static routes + one entry per WordPress blog post.
// Run at build time (`npm run generate:sitemap`). Best-effort on posts — if
// WordPress is unreachable, it still writes the static routes so the build never
// fails on a flaky network.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SITE_URL = 'https://fardelins.com';
const WP_POSTS = `${SITE_URL}/wp-json/wp/v2/posts?per_page=100&_fields=slug,modified`;

const STATIC_ROUTES = [
  { loc: '/', changefreq: 'weekly', priority: '1.0' },
  { loc: '/blogs', changefreq: 'daily', priority: '0.9' },
  { loc: '/contact', changefreq: 'monthly', priority: '0.6' },
  { loc: '/download', changefreq: 'monthly', priority: '0.7' },
  { loc: '/terms', changefreq: 'yearly', priority: '0.3' },
  { loc: '/privacy', changefreq: 'yearly', priority: '0.3' },
];

async function fetchPosts() {
  try {
    const res = await fetch(WP_POSTS, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[sitemap] Could not fetch WordPress posts (${err.message}). Writing static routes only.`);
    return [];
  }
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  const parts = [`    <loc>${SITE_URL}${loc}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) parts.push(`    <priority>${priority}</priority>`);
  return `  <url>\n${parts.join('\n')}\n  </url>`;
}

async function main() {
  const posts = await fetchPosts();
  const postEntries = posts
    .filter((p) => p?.slug)
    .map((p) => ({
      loc: `/blogs/${p.slug}`,
      lastmod: p.modified ? new Date(p.modified).toISOString() : undefined,
      changefreq: 'weekly',
      priority: '0.8',
    }));

  const urls = [...STATIC_ROUTES, ...postEntries].map(urlEntry).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sitemap.xml');
  await writeFile(outPath, xml, 'utf8');
  console.log(`[sitemap] Wrote ${STATIC_ROUTES.length + postEntries.length} URLs to public/sitemap.xml`);
}

main();
