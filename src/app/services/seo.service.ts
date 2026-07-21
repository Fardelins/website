import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

/** Canonical production origin. Keep in sync with the deployed domain. */
export const SITE_URL = 'https://fardelins.com';
export const SITE_NAME = 'Fardelins';
/** 1200×630 social share image served from /public. */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

export interface SeoData {
  title: string;
  description: string;
  /** Route path, e.g. '/blogs/some-slug'. Drives canonical + og:url. */
  path: string;
  image?: string | null;
  type?: 'website' | 'article';
  /** ISO date for articles. */
  publishedTime?: string;
  robots?: string;
  /** Structured data object(s) injected as a single ld+json script. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** LCP image preloaded into the SSR head so it fetches before app JS; supports responsive srcset/sizes. */
  preloadImage?: {
    href: string;
    imagesrcset?: string;
    imagesizes?: string;
    /** e.g. 'image/avif' — restricts preload to browsers that support it. */
    type?: string;
  };
}

const JSONLD_ID = 'seo-jsonld';
const PRELOAD_IMAGE_ID = 'seo-preload-image';

// Sets every per-route SEO tag (title, canonical, OG, Twitter, robots, JSON-LD)
// through the injected DOCUMENT so they're in the SSR HTML crawlers read.
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  update(data: SeoData): void {
    const url = this.absolute(data.path);
    const image = data.image ? this.absolute(data.image) : DEFAULT_OG_IMAGE;
    const type = data.type ?? 'website';
    const fullTitle = data.title.includes(SITE_NAME) ? data.title : `${data.title} | ${SITE_NAME}`;

    this.title.setTitle(fullTitle);
    this.setName('description', data.description);
    this.setName('robots', data.robots ?? 'index, follow');

    this.setProperty('og:site_name', SITE_NAME);
    this.setProperty('og:type', type);
    this.setProperty('og:title', fullTitle);
    this.setProperty('og:description', data.description);
    this.setProperty('og:url', url);
    this.setProperty('og:image', image);

    this.setName('twitter:card', 'summary_large_image');
    this.setName('twitter:title', fullTitle);
    this.setName('twitter:description', data.description);
    this.setName('twitter:image', image);

    if (type === 'article' && data.publishedTime) {
      this.setProperty('article:published_time', data.publishedTime);
    } else {
      this.meta.removeTag("property='article:published_time'");
    }

    this.setCanonical(url);
    this.setJsonLd(data.jsonLd);
    this.setPreloadImage(data.preloadImage);
  }

  private absolute(pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    return SITE_URL + (pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`);
  }

  private setName(name: string, content: string): void {
    this.meta.updateTag({ name, content });
  }

  private setProperty(property: string, content: string): void {
    this.meta.updateTag({ property, content });
  }

  private setCanonical(url: string): void {
    const head = this.doc.head;
    if (!head) return;
    let link = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private setJsonLd(data: SeoData['jsonLd']): void {
    const head = this.doc.head;
    if (!head) return;
    let script = head.querySelector<HTMLScriptElement>(`script#${JSONLD_ID}`);
    if (!data) {
      script?.remove();
      return;
    }
    if (!script) {
      script = this.doc.createElement('script');
      script.type = 'application/ld+json';
      script.id = JSONLD_ID;
      head.appendChild(script);
    }
    script.textContent = JSON.stringify(data);
  }

  private setPreloadImage(image: SeoData['preloadImage']): void {
    const head = this.doc.head;
    if (!head) return;
    let link = head.querySelector<HTMLLinkElement>(`link#${PRELOAD_IMAGE_ID}`);
    // Client-side navigation to a route without an LCP image: drop any stale tag.
    if (!image) {
      link?.remove();
      return;
    }
    if (!link) {
      link = this.doc.createElement('link');
      link.id = PRELOAD_IMAGE_ID;
      link.setAttribute('rel', 'preload');
      link.setAttribute('as', 'image');
      link.setAttribute('fetchpriority', 'high');
      head.appendChild(link);
    }
    link.setAttribute('href', image.href);
    this.toggleAttr(link, 'imagesrcset', image.imagesrcset);
    this.toggleAttr(link, 'imagesizes', image.imagesizes);
    this.toggleAttr(link, 'type', image.type);
  }

  private toggleAttr(el: HTMLElement, name: string, value?: string): void {
    if (value) el.setAttribute(name, value);
    else el.removeAttribute(name);
  }
}
