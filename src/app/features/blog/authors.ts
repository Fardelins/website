export interface Author {
  name: string;
  /** Square image in /public. */
  avatar: string;
  /** Alt text; empty for the decorative brand fallback. */
  avatarAlt: string;
}

// WordPress author enumeration is disabled on the CMS, so we map the post's
// numeric author id to a locally-curated profile instead of reading /wp/v2/users.
// Add an entry here (with a square photo in /public/blogs/authors/) per writer.
const AUTHORS: Record<number, Author> = {
  1: {
    name: 'Fardelins',
    avatar: '/home/app-icon.svg',
    avatarAlt: '',
  },
  2: {
    name: 'Flora Ayoka',
    avatar: '/blogs/authors/flora-200.webp',
    avatarAlt: 'Flora Ayoka',
  },
  // Rarely authors posts; GitHub avatar hotlinked rather than self-hosted.
  3: {
    name: 'Bamiboy',
    avatar: 'https://github.com/designedbybami.png',
    avatarAlt: 'Bamiboy',
  },
};

const FALLBACK_AUTHOR: Author = {
  name: 'Fardelins',
  avatar: '/home/app-icon.svg',
  avatarAlt: '',
};

/** Resolve a post's author id to a display profile, falling back to the brand. */
export function resolveAuthor(authorId: number | null): Author {
  return (authorId !== null && AUTHORS[authorId]) || FALLBACK_AUTHOR;
}
