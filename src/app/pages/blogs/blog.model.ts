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
}
