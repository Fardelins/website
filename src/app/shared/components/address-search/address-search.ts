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

  /** Every keystroke, so a hand-typed address is never lost. */
  readonly valueChange = output<string>();
  /** A suggestion was picked and its details loaded. */
  readonly placeSelected = output<PlaceDetails>();

  private readonly autoId = `address-search-${++nextId}`;
  protected readonly listId = `address-search-list-${nextId}`;
  protected readonly fieldId = computed(() => this.id() || this.autoId);
  protected readonly query = signal('');
  protected readonly suggestions = signal<PlaceSuggestion[]>([]);
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(-1);

  private timer: ReturnType<typeof setTimeout> | undefined;
  private blurTimer: ReturnType<typeof setTimeout> | undefined;
  private request = 0;

  constructor() {
    effect(() => this.query.set(this.value()));
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
    clearTimeout(this.timer);
    const request = ++this.request;
    if (raw.trim().length < 3) {
      this.suggestions.set([]);
      this.open.set(false);
      return;
    }
    this.timer = setTimeout(async () => {
      const found = await this.places.suggest(raw);
      if (request !== this.request) return;
      this.suggestions.set(found);
      this.open.set(found.length > 0);
    }, DEBOUNCE_MS);
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
    if (request !== this.request || !details) return;
    this.query.set(details.street);
    this.placeSelected.emit(details);
  }
}
