export interface BlogArticle {
  id: number;
  slug: string;
  category: string;
  categoryId: number | null;
  readTime: string;
  title: string;
  excerpt: string;
  /** Featured image URL, or null when the WordPress post has none set. */
  image: string | null;
  /**
   * Responsive `srcset` built from WordPress's generated sizes, or null when
   * unavailable. The display box is cropped to a fixed landscape ratio in CSS,
   * so the template supplies static `width`/`height` for that ratio; `srcset`
   * only governs which resolution the browser downloads.
   */
  imageSrcset: string | null;
  /** Live fardelins.com/wp-admin post URL — cards link straight out to it. */
  link: string;
}

export interface BlogCategory {
  id: number;
  name: string;
}

export interface BlogArticleDetail extends BlogArticle {
  /** Sanitized post body HTML from WordPress, rendered into the article column. */
  contentHtml: string;
  /** Human-formatted publish date, e.g. "May 12, 2025". */
  date: string;
  /** Raw ISO publish date for structured data (`datePublished`). */
  dateIso: string;
}
