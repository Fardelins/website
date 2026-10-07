import { TitleCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { solarAltArrowDownBoldDuotone } from '@ng-icons/solar-icons/bold-duotone';

export interface ComboboxOption {
  id: number | string;
  label: string;
}

let nextId = 0;

/**
 * Searchable text input backed by a filtered option list. In `strict` mode the
 * value must resolve to a real option to count as a selection (State); otherwise
 * whatever is typed is a valid value on its own, with matches offered as suggestions
 * (City), the API doesn't cover every city, so free text has to stay possible.
 */
@Component({
  selector: 'app-combobox',
  imports: [TitleCasePipe, NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ solarAltArrowDownBoldDuotone })],
  templateUrl: './combobox.html',
  styleUrl: './combobox.css',
})
export class Combobox {
  readonly options = input<ComboboxOption[]>([]);
  readonly value = input('');
  readonly name = input('');
  readonly id = input('');
  readonly placeholder = input('');
  readonly strict = input(false);
  readonly required = input(false);
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly loadingLabel = input('Loading...');
  readonly emptyLabel = input('No matches');

  readonly selected = output<ComboboxOption>();

  private readonly autoId = `combobox-field-${++nextId}`;
  protected readonly listId = `combobox-list-${nextId}`;
  protected readonly fieldId = computed(() => this.id() || this.autoId);
  protected readonly query = signal('');
  protected readonly open = signal(false);
  protected readonly activeIndex = signal(-1);

  private readonly field = viewChild<ElementRef<HTMLInputElement>>('field');
  private readonly titleCasePipe = new TitleCasePipe();

  protected readonly filtered = computed(() => {
    const term = this.query().trim().toLowerCase();
    const options = this.options();
    if (!term) return options;
    return options.filter((option) => option.label.toLowerCase().includes(term));
  });

  constructor() {
    effect(() => this.query.set(this.value()));
  }

  protected onInput(raw: string): void {
    this.query.set(raw);
    this.open.set(true);
    this.activeIndex.set(-1);
  }

  protected onFocus(): void {
    if (!this.disabled()) this.open.set(true);
  }

  protected onBlur(): void {
    // Deferred so a mousedown-selected option (see (mousedown) below) still lands first.
    setTimeout(() => {
      this.open.set(false);
      this.reconcile();
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    const options = this.filtered();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.open.set(true);
      this.activeIndex.set(Math.min(this.activeIndex() + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeIndex.set(Math.max(this.activeIndex() - 1, 0));
    } else if (event.key === 'Enter') {
      const active = options[this.activeIndex()];
      if (active) {
        event.preventDefault();
        this.choose(active);
      }
    } else if (event.key === 'Escape') {
      this.open.set(false);
    }
  }

  protected choose(option: ComboboxOption): void {
    this.query.set(this.titleCasePipe.transform(option.label));
    this.open.set(false);
    this.activeIndex.set(-1);
    this.selected.emit(option);
    this.field()?.nativeElement.focus();
  }

  private reconcile(): void {
    if (!this.strict()) return;
    const term = this.query().trim().toLowerCase();
    const match = this.options().find((option) => option.label.toLowerCase() === term);
    if (match) {
      this.query.set(this.titleCasePipe.transform(match.label));
      this.selected.emit(match);
    }
  }
}
