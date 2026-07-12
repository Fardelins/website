import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BlogCard } from '../../components/blog-card/blog-card';
import { BlogLoader } from '../../components/blog-loader/blog-loader';
import { BlogNewsletter } from '../../components/blog-newsletter/blog-newsletter';
import { BlogArticle, BlogArticleDetail } from '../blogs/blog.model';
import { BlogService } from '../blogs/blog.service';

const RELATED_COUNT = 3;

@Component({
  selector: 'app-blog-detail',
  imports: [BlogCard, BlogLoader, BlogNewsletter, RouterLink],
  templateUrl: './blog-detail.html',
  styleUrl: './blog-detail.css',
})
export class BlogDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly blogService = inject(BlogService);

  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  protected readonly notFound = signal(false);
  protected readonly article = signal<BlogArticleDetail | null>(null);
  protected readonly related = signal<BlogArticle[]>([]);

  protected readonly copied = signal(false);
  protected readonly shareUrl = computed(() => this.article()?.link ?? '');

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug');
      if (slug) void this.load(slug);
    });
  }

  private async load(slug: string): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    this.notFound.set(false);
    this.article.set(null);
    this.related.set([]);
    try {
      const article = await this.blogService.fetchArticleBySlug(slug);
      if (!article) {
        this.notFound.set(true);
        return;
      }
      this.article.set(article);
      this.related.set(await this.blogService.fetchRelated(article.categoryId, article.id, RELATED_COUNT));
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected async copyLink(): Promise<void> {
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
    const text = encodeURIComponent(this.article()?.title ?? '');
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
