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
  /** Responsive `srcset` from WordPress's sizes (null if none); the template sets static width/height. */
  imageSrcset: string | null;
}

export interface BlogCategory {
  id: number;
  name: string;
}

export interface BlogArticleDetail extends BlogArticle {
  /** Sanitized post body HTML from WordPress, rendered into the article column. */
  contentHtml: string;
  /** SEO/meta description: the authored excerpt, or a body-derived summary when the post has none. */
  metaDescription: string;
  /** Human-formatted publish date, e.g. "May 12, 2025". */
  date: string;
  /** Raw ISO publish date for structured data (`datePublished`). */
  dateIso: string;
}
