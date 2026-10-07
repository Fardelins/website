export type SearchScope = 'actions' | 'parcels' | 'tracking' | 'help';

export interface SearchResult {
  id: string;
  scope: SearchScope;
  title: string;
  /** Second line: address, tracking id, or the start of an answer. */
  detail?: string;
  icon: string;
  /** Internal route. Mutually exclusive with `href`. */
  link?: unknown[];
  /** External or public URL, opened in a new tab. */
  href?: string;
  /** Rendered on the right, e.g. a keyboard shortcut. */
  hint?: string;
  /**
   * Words people actually type for this entry. "send" and "ship" have to reach
   * "Create delivery", which shares no substring with either.
   */
  keywords?: string[];
}

export interface SearchGroup {
  scope: SearchScope;
  label: string;
  results: SearchResult[];
}

export const SCOPE_LABELS: Record<SearchScope, string> = {
  actions: 'Suggested',
  parcels: 'Parcels',
  tracking: 'Public tracking',
  help: 'Help',
};
