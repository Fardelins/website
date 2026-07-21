import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom, timeout, type Observable } from 'rxjs';
import { wordpressPublicUrl } from '../../config/wordpress.config';
import { BlogArticle, BlogArticleDetail, BlogCategory } from './blog.model';

const WORDS_PER_MINUTE = 200;

// Cap every read so a slow CMS can't hang SSR (an open fetch stalls the whole
// server response); on timeout the caller's catch renders the error/empty state.
const REQUEST_TIMEOUT_MS = 8000;

interface WpMediaSize {
  source_url: string;
  width?: number;
}

interface WpFeaturedMedia {
  source_url?: string;
  media_details?: { width?: number; sizes?: Record<string, WpMediaSize> };
}

interface WpPost {
  id: number;
  slug: string;
  link: string;
  date: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  categories: number[];
  _embedded?: { 'wp:featuredmedia'?: WpFeaturedMedia[] };
}

interface WpCategory {
  id: number;
  name: string;
  count: number;
}

export interface BlogPage {
  articles: BlogArticle[];
  totalPages: number;
}

/** Reads published posts from the live WordPress REST API (public, CORS-enabled). */
@Injectable({ providedIn: 'root' })
export class BlogService {
  private readonly http = inject(HttpClient);
  private categoryNames = new Map<number, string>();

  /** Public REST reads stay independent of the app server's reverse proxy. */
  private readonly wpBase = wordpressPublicUrl('/wp-json/wp/v2');

  /** Await an HTTP read with a hard timeout so no request can hang indefinitely. */
  private read<T>(request$: Observable<T>): Promise<T> {
    return firstValueFrom(request$.pipe(timeout(REQUEST_TIMEOUT_MS)));
  }

  async fetchCategories(): Promise<BlogCategory[]> {
    const categories = await this.read(
      this.http.get<WpCategory[]>(`${this.wpBase}/categories`, {
        params: {
          per_page: '100',
          hide_empty: 'true',
          orderby: 'count',
          order: 'desc',
          _fields: 'id,name,count',
        },
      }),
    );
    this.categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    return categories.map((category) => ({ id: category.id, name: category.name }));
  }

  async fetchArticles(
    page: number,
    perPage: number,
    categoryId?: number,
    search?: string,
  ): Promise<BlogPage> {
    if (this.categoryNames.size === 0) {
      await this.fetchCategories();
    }

    const params: Record<string, string> = {
      page: String(page),
      per_page: String(perPage),
      _embed: 'wp:featuredmedia',
      _fields: 'id,slug,link,title,excerpt,content,categories,_links,_embedded',
    };
    if (categoryId) params['categories'] = String(categoryId);
    if (search) params['search'] = search;

    const response = await this.read(
      this.http.get<WpPost[]>(`${this.wpBase}/posts`, { params, observe: 'response' }),
    );
    const totalPages = Number(response.headers.get('X-WP-TotalPages') ?? '1');

    return {
      articles: (response.body ?? []).map((post) => this.mapPost(post)),
      totalPages,
    };
  }

  /** Full single post for the detail page, looked up by slug. Returns null when not found. */
  async fetchArticleBySlug(slug: string): Promise<BlogArticleDetail | null> {
    if (this.categoryNames.size === 0) {
      await this.fetchCategories();
    }

    const posts = await this.read(
      this.http.get<WpPost[]>(`${this.wpBase}/posts`, {
        params: {
          slug,
          _embed: 'wp:featuredmedia',
          _fields: 'id,slug,link,date,title,excerpt,content,categories,_links,_embedded',
        },
      }),
    );
    const post = posts[0];
    if (!post) return null;

    const mapped = this.mapPost(post);
    // Crawlers still need a description even when the post has no excerpt; fall
    // back to the body's opening text so the meta tag is never empty.
    const metaDescription = (mapped.excerpt || stripHtml(post.content?.rendered ?? '')).slice(0, 300);
    return {
      ...mapped,
      contentHtml: normalizeContent(post.content?.rendered ?? '', mapped.image),
      metaDescription,
      date: formatDate(post.date),
      dateIso: post.date ? new Date(post.date).toISOString() : '',
    };
  }

  /** Sibling posts in the same category, excluding the one being viewed. */
  async fetchRelated(
    categoryId: number | null,
    excludeId: number,
    limit: number,
  ): Promise<BlogArticle[]> {
    const params: Record<string, string> = {
      per_page: String(limit),
      exclude: String(excludeId),
      _embed: 'wp:featuredmedia',
      _fields: 'id,slug,link,title,excerpt,content,categories,_links,_embedded',
    };
    if (categoryId) params['categories'] = String(categoryId);

    let posts = await this.read(this.http.get<WpPost[]>(`${this.wpBase}/posts`, { params }));

    // If the category didn't yield enough, top up with the latest posts overall.
    if (posts.length < limit) {
      const fallback = await this.read(
        this.http.get<WpPost[]>(`${this.wpBase}/posts`, {
          params: {
            per_page: String(limit + 1),
            exclude: String(excludeId),
            _embed: 'wp:featuredmedia',
            _fields: params['_fields'],
          },
        }),
      );
      const seen = new Set(posts.map((p) => p.id));
      posts = [...posts, ...fallback.filter((p) => !seen.has(p.id))].slice(0, limit);
    }

    return posts.map((post) => this.mapPost(post));
  }

  private mapPost(post: WpPost): BlogArticle {
    const media = post._embedded?.['wp:featuredmedia']?.[0];
    const { image, imageSrcset } = mapMedia(media);

    const categoryId = post.categories?.[0] ?? null;
    const category = categoryId !== null ? (this.categoryNames.get(categoryId) ?? 'Blog') : 'Blog';

    return {
      id: post.id,
      slug: post.slug,
      category,
      categoryId,
      readTime: estimateReadTime(post.content?.rendered ?? ''),
      title: toTitleCase(stripHtml(post.title?.rendered ?? '')),
      excerpt: resolveExcerpt(post.excerpt?.rendered ?? '', post.content?.rendered ?? ''),
      image,
      imageSrcset,
      link: post.link,
    };
  }
}

interface MappedMedia {
  image: string | null;
  imageSrcset: string | null;
}

// Pick a mid-size `src` and build a responsive `srcset` from WordPress's
// generated sizes. No intrinsic dims — the template crops to a fixed CSS ratio.
function mapMedia(media?: WpFeaturedMedia): MappedMedia {
  const sizes = media?.media_details?.sizes ?? {};
  const chosen = sizes['medium_large'] ?? sizes['large'];
  const image = chosen?.source_url ?? media?.source_url ?? null;
  if (!image) {
    return { image: null, imageSrcset: null };
  }

  // Unique URL+width candidates, ascending; null when there's only the one src.
  const candidates = new Map<string, number>();
  for (const size of Object.values(sizes)) {
    if (size.source_url && size.width) candidates.set(size.source_url, size.width);
  }
  if (media?.source_url && media.media_details?.width) {
    candidates.set(media.source_url, media.media_details.width);
  }
  const imageSrcset =
    candidates.size > 1
      ? [...candidates.entries()]
          .sort((a, b) => a[1] - b[1])
          .map(([url, width]) => `${url} ${width}w`)
          .join(', ')
      : null;

  return { image, imageSrcset };
}

/** WordPress titles arrive in inconsistent casing (some fully uppercase) — normalize to Title Case. */
function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function stripHtml(html: string): string {
  // Server (SSR/prerender) has no DOM — fall back to a regex strip + basic entity decode.
  if (typeof document === 'undefined') {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#8217;|&rsquo;/g, '’')
      .replace(/&#8216;|&lsquo;/g, '‘')
      .replace(/&#8220;|&ldquo;/g, '“')
      .replace(/&#8221;|&rdquo;/g, '”')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

// Authored excerpts run ≤10% of the body, auto-derived ones ~80%+; 0.5 splits them.
const AUTO_EXCERPT_BODY_RATIO = 0.5;

// WP always returns an excerpt — authored, or auto-derived from the body. Drop the
// derived one (it just repeats the article), detected by its "[…]" marker or length.
function resolveExcerpt(excerptHtml: string, contentHtml: string): string {
  const excerpt = stripHtml(excerptHtml);
  if (!excerpt) return '';

  // The "[…]" excerpt_more marker is appended only to auto-generated excerpts.
  if (/\[\s*(?:…|\.\.\.|&hellip;)\s*\]\s*$/u.test(excerpt)) return '';

  const content = stripHtml(contentHtml);
  if (content.length && excerpt.length / content.length >= AUTO_EXCERPT_BODY_RATIO) return '';

  return excerpt;
}

function estimateReadTime(html: string): string {
  const wordCount = stripHtml(html).split(' ').filter(Boolean).length;
  const minutes = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
  return `${minutes} min read`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Filename stem ignoring WordPress's `-WxH` size suffix, e.g. `img-300x300.png` -> `img.png`. */
function imageStem(url: string | null): string {
  if (!url) return '';
  return (url.split('/').pop() ?? '').split('?')[0].replace(/-\d+x\d+(?=\.\w+$)/, '');
}

// The WP block editor emits broken markup (empty list scaffolding, headings
// inside <li>, bare text nodes, wp comments, a duplicated hero image). Clean it up.
function normalizeContent(html: string, featuredImage: string | null): string {
  // No DOM during SSR: strip wp comments and demote H1s for crawlers; the browser
  // re-runs full normalization on hydration.
  if (typeof DOMParser === 'undefined' || typeof document === 'undefined') {
    return html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(script|style|noscript|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<\/?(?:figure|figcaption)\b[^>]*>/gi, '')
      .replace(/<h1(\s[^>]*)?>/gi, '<h2$1>')
      .replace(/<\/h1>/gi, '</h2>')
      .replace(/\s(?:style|id|on[a-z]+|data-[\w-]+)=(?:"[^"]*"|'[^']*')/gi, '')
      .trim();
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;

  // 1. Strip HTML comment nodes.
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
  const comments: Comment[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode as Comment);
  comments.forEach((node) => node.remove());

  // The article title is the page's only H1. WordPress body headings start at H2.
  body.querySelectorAll('h1').forEach((heading) => {
    const replacement = doc.createElement('h2');
    Array.from(heading.attributes).forEach((attribute) =>
      replacement.setAttribute(attribute.name, attribute.value),
    );
    replacement.innerHTML = heading.innerHTML;
    heading.replaceWith(replacement);
  });

  // 2. Drop images that just duplicate the hero's featured image.
  const featStem = imageStem(featuredImage);
  body.querySelectorAll('img').forEach((img) => {
    if (featStem && imageStem(img.getAttribute('src')) === featStem) img.remove();
  });

  // 3. Collapse single-item `<ul><li><ul>…</ul></li></ul>` wrapper nesting.
  let changed = true;
  while (changed) {
    changed = false;
    body.querySelectorAll('ul, ol').forEach((list) => {
      const items = Array.from(list.children).filter((child) => child.tagName === 'LI');
      if (items.length !== 1) return;
      const li = items[0];
      const innerLists = Array.from(li.children).filter(
        (child) => child.tagName === 'UL' || child.tagName === 'OL',
      );
      if (innerLists.length === 1 && !textOf(li).replace(textOf(innerLists[0]), '').trim()) {
        list.replaceWith(innerLists[0]);
        changed = true;
      }
    });
  }

  // 4. A list item with a heading is a stacked subheading+body, not a bullet — hoist it out.
  body.querySelectorAll('li').forEach((li) => {
    if (!li.querySelector('h1, h2, h3, h4, h5, h6')) return;
    const list = li.closest('ul, ol');
    if (!list?.parentNode) return;
    const frag = doc.createDocumentFragment();
    Array.from(li.childNodes).forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent?.trim();
        if (text) {
          const p = doc.createElement('p');
          p.textContent = text;
          frag.appendChild(p);
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        frag.appendChild(child);
      }
    });
    list.parentNode.insertBefore(frag, list);
    li.remove();
  });

  // 5. Remove now-empty structural elements.
  body.querySelectorAll('li, ul, ol, p').forEach((el) => {
    if (!textOf(el) && !el.querySelector('img')) el.remove();
  });

  // 6. Wrap bare text nodes sitting directly under the root in paragraphs.
  Array.from(body.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      const p = doc.createElement('p');
      p.textContent = node.textContent.trim();
      node.replaceWith(p);
    }
  });

  // 7. Pre-apply what Angular's [innerHTML] sanitizer does anyway, so it has
  // nothing left to strip (and stops logging "sanitizing HTML stripped some
  // content"). The sanitizer stays on as our safety net; this just makes the
  // output already conform to its allowlist. See the allowlist in @angular/core.
  body.querySelectorAll('script, style, noscript, iframe').forEach((el) => el.remove());
  // figure/figcaption aren't allowed elements; Angular unwraps them (keeping
  // the inner img/text), so do the same rather than lose the content.
  body.querySelectorAll('figure, figcaption').forEach((el) => {
    el.replaceWith(...Array.from(el.childNodes));
  });
  // Drop attributes Angular rejects: inline style, id, data-*, and on* handlers.
  body.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name === 'style' || name === 'id' || name.startsWith('data-') || name.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    }
  });

  return body.innerHTML;
}

function textOf(el: Element): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}
