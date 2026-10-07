import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarMagniferBoldDuotone,
  solarAddCircleBoldDuotone,
  solarBoxBoldDuotone,
  solarBillListBoldDuotone,
  solarUserRoundedBoldDuotone,
  solarQuestionCircleBoldDuotone,
  solarMapPointWaveBoldDuotone,
  solarCloseCircleBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { HapticsService } from '@core/services/haptics.service';
import { SearchService } from '../search.service';
import { SearchResult, SearchScope } from '../search.models';
import { AsciiSpotlight } from '@shared/components/ascii-spotlight/ascii-spotlight';

const SCOPES: { key: SearchScope; label: string; icon: string }[] = [
  { key: 'parcels', label: 'Parcels', icon: 'solarBoxBoldDuotone' },
  { key: 'tracking', label: 'Tracking', icon: 'solarMapPointWaveBoldDuotone' },
  { key: 'actions', label: 'Actions', icon: 'solarAddCircleBoldDuotone' },
  { key: 'help', label: 'Help', icon: 'solarQuestionCircleBoldDuotone' },
];

@Component({
  selector: 'app-command-palette',
  imports: [NgIcon, AsciiSpotlight],
  viewProviders: [
    provideIcons({
      solarMagniferBoldDuotone,
      solarAddCircleBoldDuotone,
      solarBoxBoldDuotone,
      solarBillListBoldDuotone,
      solarUserRoundedBoldDuotone,
      solarQuestionCircleBoldDuotone,
      solarMapPointWaveBoldDuotone,
      solarCloseCircleBoldDuotone,
    }),
  ],
  templateUrl: './command-palette.html',
  styleUrl: './command-palette.css',
})
export class CommandPalette {
  private readonly search = inject(SearchService);
  private readonly router = inject(Router);
  private readonly haptics = inject(HapticsService);

  readonly open = input(false);
  readonly closed = output<void>();

  protected readonly scopes = SCOPES;
  protected readonly query = signal('');
  protected readonly scope = signal<SearchScope | null>(null);
  protected readonly active = signal(0);

  protected readonly groups = computed(() => this.search.search(this.query(), this.scope()));
  /** Flattened in render order, so arrow keys can walk across group boundaries. */
  protected readonly flat = computed(() => this.groups().flatMap((group) => group.results));
  protected readonly empty = computed(() => this.flat().length === 0);

  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');

  constructor() {
    effect(() => {
      if (!this.open()) return;
      void this.search.prime();
      this.query.set('');
      this.scope.set(null);
      this.active.set(0);
      // The dialog is created by @if, so wait a frame for the input to exist.
      requestAnimationFrame(() => this.field()?.nativeElement.focus());
    });
  }

  protected setQuery(value: string): void {
    this.query.set(value);
    this.active.set(0);
  }

  protected setScope(scope: SearchScope | null): void {
    this.haptics.selection();
    this.scope.set(this.scope() === scope ? null : scope);
    this.active.set(0);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const total = this.flat().length;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const result = this.flat()[this.active()];
      if (result) this.run(result);
      return;
    }
    if (!total) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.active.set((this.active() + 1) % total);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.active.set((this.active() - 1 + total) % total);
    }
  }

  protected indexOf(result: SearchResult): number {
    return this.flat().findIndex((item) => item.id === result.id);
  }

  protected run(result: SearchResult): void {
    this.haptics.light();
    this.close();
    if (result.link) {
      void this.router.navigate(result.link);
    } else if (result.href) {
      globalThis.open(result.href, '_blank', 'noopener');
    }
  }

  protected close(): void {
    this.closed.emit();
  }

  /** Enter on a query with no match still has somewhere useful to go. */
  protected searchAllParcels(): void {
    const term = this.query().trim();
    this.close();
    void this.router.navigate(['/app/deliveries'], {
      queryParams: term ? { q: term } : {},
    });
  }

  protected openHelp(): void {
    this.close();
    void this.router.navigate(['/app/help']);
  }
}
