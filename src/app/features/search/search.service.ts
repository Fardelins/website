import { Injectable, inject, signal } from '@angular/core';
import { DeliveriesService } from '@features/deliveries/deliveries.service';
import { DeliverySummary } from '@features/deliveries/deliveries.model';
import { ACTIONS, HELP_INDEX } from './search-index.data';
import { SearchGroup, SearchResult, SearchScope, SCOPE_LABELS } from './search.models';

const MAX_PER_GROUP = 5;
const MAX_PARCEL_SUGGESTIONS = 7;
const SHIPPED_STATUSES = new Set([
  'picked_up',
  'enroute',
  'out_for_delivery',
  'delivered',
  'shipped',
  'in_transit',
]);
/** A real keyword or title hit, as opposed to an incidental substring. */
const ANCHOR_SCORE = 6;

/** Ids mix letters and digits, so ordinary words like "macbook" or "refund" don't match. */
const TRACKING_SHAPE = /^(?=[a-z0-9-]*[a-z])(?=[a-z0-9-]*\d)[a-z0-9-]{8,}$/i;

/** Words too common to carry intent; dropped so "where is my parcel" still ranks well. */
const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'my',
  'me',
  'i',
  'is',
  'are',
  'was',
  'be',
  'am',
  'to',
  'for',
  'of',
  'in',
  'on',
  'at',
  'from',
  'with',
  'about',
  'do',
  'does',
  'did',
  'have',
  'has',
  'get',
  'got',
  'how',
  'can',
  'could',
  'should',
  'would',
  'will',
  'what',
  'want',
  'need',
  'much',
  'many',
  'it',
  'this',
  'that',
  'there',
  'any',
  'some',
  'please',
]);

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly deliveries = inject(DeliveriesService);
  private readonly parcels = signal<DeliverySummary[]>([]);

  /** Warms the parcel index off the shared cache; safe to call on every palette open. */
  async prime(): Promise<void> {
    try {
      this.parcels.set(await this.deliveries.list());
    } catch {
      this.parcels.set([]);
    }
  }

  search(rawQuery: string, scope: SearchScope | null): SearchGroup[] {
    const query = rawQuery.trim();
    const tokens = tokenize(query);
    const groups: SearchGroup[] = [];

    const push = (key: SearchScope, results: SearchResult[]): void => {
      if (!results.length || (scope && scope !== key)) return;
      groups.push({
        scope: key,
        label: SCOPE_LABELS[key],
        results: results.slice(0, key === 'parcels' ? MAX_PARCEL_SUGGESTIONS : MAX_PER_GROUP),
      });
    };

    if (!tokens.length) {
      push('parcels', this.suggestedParcels());
      push('actions', ACTIONS.slice(0, 4));
    } else {
      push('actions', rank(ACTIONS, tokens));
      push('parcels', rank(this.parcelResults(), tokens));
    }
    push('tracking', this.trackingResults(query));
    push('help', tokens.length ? rank(HELP_INDEX, tokens) : []);

    return groups;
  }

  private parcelResults(): SearchResult[] {
    return this.parcels().map((parcel) => this.toResult(parcel));
  }

  private suggestedParcels(): SearchResult[] {
    return [...this.parcels()]
      .sort((left, right) => Number(isShipped(right.status)) - Number(isShipped(left.status)))
      .slice(0, MAX_PARCEL_SUGGESTIONS)
      .map((parcel) => this.toResult(parcel));
  }

  private toResult(parcel: DeliverySummary): SearchResult {
    return {
      id: `parcel-${parcel.trackingId}`,
      scope: 'parcels',
      title: parcel.title,
      detail: [parcel.trackingId, parcel.dropOff].filter(Boolean).join(' · '),
      icon: 'solarBoxBoldDuotone',
      link: ['/app/deliveries', parcel.trackingId],
      keywords: [parcel.trackingId, parcel.receiverName, parcel.dropOff, parcel.status].filter(
        (value): value is string => Boolean(value),
      ),
    };
  }

  // Anything id-shaped becomes a public-tracking offer, even for a parcel that isn't
  // yours: that page takes a tracking id from anyone.
  private trackingResults(raw: string): SearchResult[] {
    if (!TRACKING_SHAPE.test(raw)) return [];
    const id = raw.toUpperCase();
    return [
      {
        id: `track-${id}`,
        scope: 'tracking',
        title: `Track ${id}`,
        detail: 'Open the public tracking page',
        icon: 'solarMapPointWaveBoldDuotone',
        link: ['/track', id],
      },
    ];
  }
}

function isShipped(status: string): boolean {
  return SHIPPED_STATUSES.has(
    status
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_'),
  );
}

function tokenize(query: string): string[] {
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const meaningful = words.filter((word) => !STOP_WORDS.has(word));
  // An all-stop-word query ("how do I") still deserves a search rather than nothing.
  return meaningful.length ? meaningful : words;
}

/**
 * Every token has to land somewhere, and where it lands sets the weight: a hit in the
 * title beats a synonym, which beats a mention in the body. That ordering is what puts
 * "Create delivery" first for "send delivery" while keeping unrelated rows out.
 */
function rank(entries: SearchResult[], tokens: string[]): SearchResult[] {
  return entries
    .map((entry) => ({ entry, score: scoreEntry(entry, tokens) }))
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((scored) => scored.entry);
}

function scoreEntry(entry: SearchResult, tokens: string[]): number {
  const title = entry.title.toLowerCase();
  const detail = (entry.detail ?? '').toLowerCase();
  const keywords = (entry.keywords ?? []).map((word) => word.toLowerCase());
  let total = 0;

  let anchored = false;
  for (const token of tokens) {
    const best = Math.max(
      fieldScore(title, token) * 3,
      keywords.some((word) => word === token) ? 8 : 0,
      keywords.some((word) => word.startsWith(token) || token.startsWith(word)) ? 6 : 0,
      keywords.some((word) => word.includes(token)) ? 4 : 0,
      fieldScore(detail, token),
    );
    if (best >= ANCHOR_SCORE) anchored = true;
    total += best;
  }
  // One solid hit carries the row; filler like "something" in "ship something" is
  // ignored rather than disqualifying the match, which is how people actually type.
  return anchored ? total : 0;
}

function fieldScore(field: string, token: string): number {
  if (!field) return 0;
  const words = field.split(/[^a-z0-9]+/).filter(Boolean);
  if (words.includes(token)) return 3;
  if (words.some((word) => word.startsWith(token))) return 2;
  return field.includes(token) ? 1 : 0;
}
