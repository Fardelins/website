import { Component, computed, inject, signal } from '@angular/core';
import { BlogCard } from '../../components/blog-card/blog-card';
import { BlogEmptyState } from '../../components/blog-empty-state/blog-empty-state';
import { BlogLoader } from '../../components/blog-loader/blog-loader';
import { BLOG_CATEGORIES, BlogArticle } from './blog-articles.data';
import { BlogService } from './blog.service';

const INITIAL_BATCH = 6;
const BATCH_STEP = 6;

@Component({
  selector: 'app-blogs',
  imports: [BlogCard, BlogLoader, BlogEmptyState],
  templateUrl: './blogs.html',
  styleUrl: './blogs.css',
})
export class Blogs {
  private readonly blogService = inject(BlogService);

  protected readonly categories = BLOG_CATEGORIES;
  protected readonly activeCategory = signal<string>('All Articles');
  protected readonly searchQuery = signal('');
  protected readonly visibleCount = signal(INITIAL_BATCH);

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  private readonly articles = signal<BlogArticle[]>([]);

  protected readonly filteredArticles = computed(() => {
    const category = this.activeCategory();
    const query = this.searchQuery().trim().toLowerCase();
    let list = this.articles();

    if (category !== 'All Articles') {
      list = list.filter((article) => article.category === category);
    }
    if (query) {
      list = list.filter(
        (article) =>
          article.title.toLowerCase().includes(query) ||
          article.excerpt.toLowerCase().includes(query) ||
          article.category.toLowerCase().includes(query),
      );
    }
    return list;
  });

  protected readonly visibleArticles = computed(() =>
    this.filteredArticles().slice(0, this.visibleCount()),
  );

  protected readonly hasMore = computed(() => this.visibleCount() < this.filteredArticles().length);
  protected readonly isEmpty = computed(() => !this.loading() && !this.error() && this.filteredArticles().length === 0);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      const articles = await this.blogService.fetchArticles();
      this.articles.set(articles);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected setCategory(category: string): void {
    this.activeCategory.set(category);
    this.visibleCount.set(INITIAL_BATCH);
  }

  protected setSearch(query: string): void {
    this.searchQuery.set(query);
    this.visibleCount.set(INITIAL_BATCH);
  }

  protected loadMore(): void {
    this.visibleCount.update((count) => count + BATCH_STEP);
  }
}
