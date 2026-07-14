import { Component, ElementRef, OnDestroy, PLATFORM_ID, computed, inject, signal, viewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BlogCard } from '../../components/blog-card/blog-card';
import { BlogLoader } from '../../components/blog-loader/blog-loader';
import { BlogNewsletter } from '../../components/blog-newsletter/blog-newsletter';
import { TiltDirective } from '../../directives/tilt.directive';
import { HapticsService } from '../../services/haptics.service';
import { SITE_NAME, SITE_URL, SeoService } from '../../services/seo.service';
import { BlogArticle, BlogArticleDetail } from '../blogs/blog.model';
import { BlogService } from '../blogs/blog.service';

const RELATED_COUNT = 3;

interface TocItem {
  id: string;
  label: string;
}

@Component({
  selector: 'app-blog-detail',
  imports: [BlogCard, BlogLoader, BlogNewsletter, RouterLink, TiltDirective],
  templateUrl: './blog-detail.html',
  styleUrl: './blog-detail.css',
})
export class BlogDetail implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly blogService = inject(BlogService);
  private readonly seo = inject(SeoService);
  private readonly haptics = inject(HapticsService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly contentRef = viewChild<ElementRef<HTMLElement>>('articleContent');

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly notFound = signal(false);
  protected readonly article = signal<BlogArticleDetail | null>(null);
  protected readonly related = signal<BlogArticle[]>([]);

  protected readonly copied = signal(false);
  protected readonly shareUrl = computed(() => this.article()?.link ?? '');

  /** Catchy, contextual message pre-filled into share intents (not just the bare title). */
  protected readonly shareText = computed(() => {
    const post = this.article();
    if (!post) return '';
    const snippet = post.excerpt.trim().replace(/\s+/g, ' ');
    const short = snippet.length > 120 ? `${snippet.slice(0, 117).trimEnd()}…` : snippet;
    return `Read our latest story on Fardelins 📦 “${post.title}”${short ? ` — ${short}` : ''}`;
  });

  protected readonly toc = signal<TocItem[]>([]);
  protected readonly activeTocId = signal('');

  /** Fill level (0–1) of the sticky TOC rail, driven by the active section — mirrors Terms. */
  protected readonly tocProgress = computed(() => {
    const items = this.toc();
    if (items.length < 2) return 0;
    const idx = items.findIndex((item) => item.id === this.activeTocId());
    return idx <= 0 ? 0 : idx / (items.length - 1);
  });

  /** Continuous scroll-through progress (0–1) for the mobile bottom reading bar. */
  protected readonly readProgress = signal(0);

  private tocObserver: IntersectionObserver | null = null;
  private scrollRaf: number | null = null;

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (slug) void this.load(slug);
    });

    if (this.isBrowser) {
      globalThis.addEventListener('scroll', this.onScroll, { passive: true });
      globalThis.addEventListener('resize', this.onScroll, { passive: true });
    }
  }

  ngOnDestroy(): void {
    this.tocObserver?.disconnect();
    if (this.isBrowser) {
      globalThis.removeEventListener('scroll', this.onScroll);
      globalThis.removeEventListener('resize', this.onScroll);
    }
    if (this.scrollRaf !== null) cancelAnimationFrame(this.scrollRaf);
  }

  private readonly onScroll = (): void => {
    if (this.scrollRaf !== null) return;
    this.scrollRaf = requestAnimationFrame(() => {
      this.scrollRaf = null;
      this.updateReadProgress();
    });
  };

  /** How far the reader has scrolled through the article body, clamped to 0–1. */
  private updateReadProgress(): void {
    const el = this.contentRef()?.nativeElement;
    if (!el) return;
    const top = el.getBoundingClientRect().top + globalThis.scrollY;
    const scrolled = globalThis.scrollY + globalThis.innerHeight - top;
    const progress = Math.min(Math.max(scrolled / el.offsetHeight, 0), 1);
    this.readProgress.set(progress);
  }

  private async load(slug: string): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    this.notFound.set(false);
    this.article.set(null);
    this.related.set([]);
    this.toc.set([]);
    this.readProgress.set(0);
    this.tocObserver?.disconnect();
    try {
      const article = await this.blogService.fetchArticleBySlug(slug);
      if (!article) {
        this.notFound.set(true);
        this.seo.update({
          title: `Article Not Found | ${SITE_NAME} Blog`,
          description: "The article you're looking for doesn't exist or may have been moved.",
          path: `/blogs/${slug}`,
          robots: 'noindex, follow',
        });
        return;
      }
      this.article.set(article);
      this.setMeta(article);
      this.related.set(await this.blogService.fetchRelated(article.categoryId, article.id, RELATED_COUNT));
      // Content lands in the DOM via [innerHTML] on the next tick — build the TOC after that (browser only).
      if (this.isBrowser) setTimeout(() => { this.buildToc(); this.updateReadProgress(); }, 0);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private setMeta(post: BlogArticleDetail): void {
    const description = post.excerpt.slice(0, 300);
    const path = `/blogs/${post.slug}`;
    const image = post.image ?? undefined;

    const jsonLd: Record<string, unknown>[] = [
      {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        description,
        ...(post.image ? { image: [post.image] } : {}),
        ...(post.dateIso ? { datePublished: post.dateIso, dateModified: post.dateIso } : {}),
        articleSection: post.category,
        author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
        publisher: {
          '@type': 'Organization',
          name: SITE_NAME,
          logo: { '@type': 'ImageObject', url: `${SITE_URL}/home/logo.svg` },
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': SITE_URL + path },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Blog', item: `${SITE_URL}/blogs` },
          { '@type': 'ListItem', position: 2, name: post.title, item: SITE_URL + path },
        ],
      },
    ];

    this.seo.update({
      title: `${post.title} | ${SITE_NAME} Blog`,
      description,
      path,
      image,
      type: 'article',
      publishedTime: post.dateIso || undefined,
      jsonLd,
    });
  }

  /** Reads the rendered article headings, assigns anchor ids, and wires scroll-spy. */
  private buildToc(): void {
    this.tocObserver?.disconnect();
    const el = this.contentRef()?.nativeElement;
    if (!el) return;

    const headings = Array.from(el.querySelectorAll<HTMLElement>('h1, h2'));
    const used = new Set<string>();
    const items: TocItem[] = [];
    headings.forEach((heading) => {
      const label = (heading.textContent ?? '').trim();
      if (!label) return;
      let id = slugify(label) || 'section';
      const base = id;
      let n = 2;
      while (used.has(id)) id = `${base}-${n++}`;
      used.add(id);
      heading.id = id;
      heading.style.scrollMarginTop = '120px';
      items.push({ id, label });
    });

    // A TOC is only useful with a few sections to jump between.
    if (items.length < 2) {
      this.toc.set([]);
      return;
    }
    this.toc.set(items);
    this.activeTocId.set(items[0].id);

    this.tocObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length) this.activeTocId.set((visible[0].target as HTMLElement).id);
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 },
    );
    headings.forEach((heading) => this.tocObserver?.observe(heading));
  }

  protected jumpTo(event: MouseEvent, id: string): void {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    this.activeTocId.set(id);
    this.haptics.selection();
    target.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }

  protected async copyLink(): Promise<void> {
    // Trigger before awaiting the clipboard so iOS still has user activation.
    this.haptics.light();
    try {
      await navigator.clipboard.writeText(this.shareUrl());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  protected shareTo(network: 'twitter' | 'whatsapp' | 'linkedin'): string {
    const url = encodeURIComponent(this.shareUrl());
    const text = encodeURIComponent(this.shareText());
    switch (network) {
      case 'twitter':
        return `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
      case 'whatsapp':
        return `https://wa.me/?text=${text}%20${url}`;
      case 'linkedin':
        return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    }
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
}
