import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  GooglePlacesService,
  PlaceDetails,
  PlaceSuggestion,
  PlacesSearchIssue,
} from '@core/services/google-places.service';

const DEBOUNCE_MS = 300;
let nextId = 0;

/**
 * A street-address input that suggests real places from Google as you type. Without a Google key,
 * or when a search fails, it is an ordinary text box, so an address can always be typed by hand.
 */
@Component({
  selector: 'app-address-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './address-search.html',
  styleUrl: './address-search.css',
})
export class AddressSearch {
  private readonly places = inject(GooglePlacesService);

  readonly value = input('');
  readonly name = input('');
  readonly id = input('');
  readonly placeholder = input('');
  readonly required = input(false);
  readonly disabled = input(false);
  readonly invalid = input(false);
  readonly autocompleteEnabled = input(true);
  /** False where the host offers its own fallback, so "enter it manually" notes would mislead. */
  readonly showIssues = input(true);
  readonly searchRequest = input(0);

  /** Every keystroke, so a hand-typed address is never lost. */
  readonly valueChange = output<string>();
  /** A suggestion was picked and its details loaded. */
  readonly placeSelected = output<PlaceDetails>();
  /** Enter pressed on typed text with no suggestion highlighted. */
  readonly submitted = output<string>();

  private readonly autoId = `address-search-${++nextId}`;
  protected readonly listId = `address-search-list-${nextId}`;
  protected readonly fieldId = computed(() => this.id() || this.autoId);
  protected readonly query = signal('');
  protected readonly suggestions = signal<PlaceSuggestion[]>([]);
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(-1);
  protected readonly searchIssue = signal<PlacesSearchIssue | null>(null);

  private timer: ReturnType<typeof setTimeout> | undefined;
  private blurTimer: ReturnType<typeof setTimeout> | undefined;
  private request = 0;
  private seenSearchRequest = 0;

  constructor() {
    effect(() => {
      const value = this.value();
      const searchRequest = this.searchRequest();
      this.query.set(value);
      if (!this.autocompleteEnabled()) {
        clearTimeout(this.timer);
        this.request++;
        this.suggestions.set([]);
        this.open.set(false);
        this.searchIssue.set(null);
      } else if (searchRequest !== this.seenSearchRequest) {
        this.seenSearchRequest = searchRequest;
        clearTimeout(this.timer);
        const request = ++this.request;
        this.suggestions.set([]);
        this.open.set(false);
        void this.search(value, request);
      }
    });
    // Pending timers and replies must not emit once the field is gone (Angular NG0953).
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      clearTimeout(this.blurTimer);
      this.request++;
    });
  }

  protected onInput(raw: string): void {
    this.query.set(raw);
    this.valueChange.emit(raw);
    this.activeIndex.set(-1);
    this.searchIssue.set(null);
    clearTimeout(this.timer);
    const request = ++this.request;
    if (!this.autocompleteEnabled() || raw.trim().length < 3) {
      this.suggestions.set([]);
      this.open.set(false);
      return;
    }
    this.timer = setTimeout(async () => {
      await this.search(raw, request);
    }, DEBOUNCE_MS);
  }

  private async search(raw: string, request: number): Promise<void> {
    const result = await this.places.search(raw);
    if (request !== this.request || !this.autocompleteEnabled()) return;
    this.suggestions.set(result.suggestions);
    this.searchIssue.set(result.issue ?? null);
    this.open.set(result.suggestions.length > 0);
  }

  protected onFocus(): void {
    clearTimeout(this.blurTimer);
    if (this.suggestions().length) this.open.set(true);
  }

  protected onBlur(): void {
    // Deferred so a mousedown-picked suggestion still lands first.
    clearTimeout(this.blurTimer);
    this.blurTimer = setTimeout(() => this.open.set(false));
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.suggestions().length;
    if (event.key === 'ArrowDown' && count) {
      event.preventDefault();
      this.open.set(true);
      this.activeIndex.set(Math.min(this.activeIndex() + 1, count - 1));
    } else if (event.key === 'ArrowUp' && count) {
      event.preventDefault();
      this.activeIndex.set(Math.max(this.activeIndex() - 1, 0));
    } else if (event.key === 'Enter' && this.open()) {
      const active = this.suggestions()[this.activeIndex()];
      if (active) {
        event.preventDefault();
        void this.choose(active);
      }
    } else if (event.key === 'Escape') {
      this.open.set(false);
    } else if (event.key === 'Enter' && this.query().trim()) {
      this.submitted.emit(this.query().trim());
    }
  }

  protected async choose(suggestion: PlaceSuggestion): Promise<void> {
    this.open.set(false);
    this.activeIndex.set(-1);
    this.suggestions.set([]);
    const request = ++this.request;
    this.query.set(suggestion.primary);
    this.valueChange.emit(suggestion.primary);
    const details = await this.places.details(suggestion);
    if (request !== this.request) return;
    if (!details) {
      this.searchIssue.set('request-failed');
      return;
    }
    this.searchIssue.set(null);
    this.query.set(details.formattedAddress || details.street);
    this.placeSelected.emit(details);
  }
}
