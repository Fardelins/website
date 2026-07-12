import { Injectable } from '@angular/core';
import { BLOG_ARTICLES, BlogArticle } from './blog-articles.data';

/** Simulated network latency so loading/empty states are actually reachable during dev. */
const SIMULATED_LATENCY_MS = 650;

/**
 * Single seam between the Blogs page and its article data. Today it resolves
 * `BLOG_ARTICLES` after a simulated delay; swapping to a real backend later
 * only means replacing the body of `fetchArticles()` with an HttpClient call
 * (e.g. `firstValueFrom(this.http.get<BlogArticle[]>('/api/articles'))`) —
 * nothing in `Blogs` (the page component) needs to change.
 */
@Injectable({ providedIn: 'root' })
export class BlogService {
  fetchArticles(): Promise<BlogArticle[]> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(BLOG_ARTICLES), SIMULATED_LATENCY_MS);
    });
  }
}
