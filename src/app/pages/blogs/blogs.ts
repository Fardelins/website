import { Component, computed, inject, signal } from '@angular/core';
import { SITE_NAME, SITE_URL, SeoService } from '../../services/seo.service';
import { BlogCard } from '../../components/blog-card/blog-card';
import { BlogEmptyState } from '../../components/blog-empty-state/blog-empty-state';
import { BlogLoader } from '../../components/blog-loader/blog-loader';
import { BlogNewsletter } from '../../components/blog-newsletter/blog-newsletter';
import { BlogArticle, BlogCategory } from './blog.model';
import { BlogService } from './blog.service';

const PAGE_SIZE = 6;
const SEARCH_DEBOUNCE_MS = 350;

@Component({
  selector: 'app-blogs',
  imports: [BlogCard, BlogLoader, BlogEmptyState, BlogNewsletter],
  templateUrl: './blogs.html',
  styleUrl: './blogs.css',
})
export class Blogs {
  private readonly blogService = inject(BlogService);
  private readonly seo = inject(SeoService);

  protected readonly categories = signal<BlogCategory[]>([]);
  protected readonly activeCategoryId = signal<number | null>(null);
  protected readonly searchQuery = signal('');

  /** True only for the very first fetch — shows the full shader loader. */
  protected readonly loading = signal(true);
  /** True for category/search-triggered refetches — dims the existing grid instead of replacing it. */
  protected readonly refreshing = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly error = signal(false);

  protected readonly articles = signal<BlogArticle[]>([]);
  protected readonly hasMore = signal(false);
  protected readonly isEmpty = computed(
    () => !this.loading() && !this.error() && this.articles().length === 0,
  );

  protected readonly activeCategoryName = computed(
    () =>
      this.categories().find((category) => category.id === this.activeCategoryId())?.name ??
      'All Articles',
  );

  private page = 1;
  private searchDebounceId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const description =
      'Stories, guides, industry updates, and expert insights on delivery, logistics, and courier operations from Fardelins.';
    this.seo.update({
      title: `Delivery and Logistics Blog | ${SITE_NAME}`,
      description,
      path: '/blogs',
      type: 'website',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: `${SITE_NAME} Blog`,
        description,
        url: `${SITE_URL}/blogs`,
        publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      },
    });
    void this.init();
  }

  private async init(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      this.categories.set(await this.blogService.fetchCategories());
      await this.loadPage(1, false);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadPage(page: number, append: boolean): Promise<void> {
    try {
      const result = await this.blogService.fetchArticles(
        page,
        PAGE_SIZE,
        this.activeCategoryId() ?? undefined,
        this.searchQuery().trim() || undefined,
      );
      this.articles.update((current) =>
        append ? [...current, ...result.articles] : result.articles,
      );
      this.hasMore.set(page < result.totalPages);
      this.page = page;
      this.error.set(false);
    } catch {
      this.error.set(true);
    } finally {
      this.refreshing.set(false);
      this.loadingMore.set(false);
    }
  }

  protected async retry(): Promise<void> {
    if (this.categories().length === 0) {
      await this.init();
      return;
    }
    this.refreshing.set(true);
    await this.loadPage(1, false);
  }

  protected async setCategory(categoryId: number | null): Promise<void> {
    if (categoryId === this.activeCategoryId()) return;
    this.activeCategoryId.set(categoryId);
    this.refreshing.set(true);
    await this.loadPage(1, false);
  }

  protected setSearch(query: string): void {
    this.searchQuery.set(query);
    if (this.searchDebounceId !== null) clearTimeout(this.searchDebounceId);
    this.searchDebounceId = setTimeout(() => {
      this.refreshing.set(true);
      void this.loadPage(1, false);
    }, SEARCH_DEBOUNCE_MS);
  }

  protected async loadMore(): Promise<void> {
    this.loadingMore.set(true);
    await this.loadPage(this.page + 1, true);
  }
}
