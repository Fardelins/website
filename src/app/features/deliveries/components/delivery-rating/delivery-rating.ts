import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { solarStarBold } from '@ng-icons/solar-icons/bold';
import {
  solarCheckCircleBoldDuotone,
  solarDangerCircleBoldDuotone,
  solarPenBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { solarStarLinear } from '@ng-icons/solar-icons/linear';
import { HapticsService } from '@core/services/haptics.service';
import { ToastService } from '@core/services/toast.service';
import { DeliveryRating, DeliveryRatingService } from '../../delivery-rating.service';

const VERDICTS = ['Very poor', 'Poor', 'Okay', 'Good', 'Excellent'] as const;
const PRAISE = [
  'On time',
  'Parcel arrived safe',
  'Friendly courier',
  'Kept me updated',
  'Easy handover',
];
const ISSUES = [
  'Arrived late',
  'Parcel was damaged',
  'Hard to reach courier',
  'No updates',
  'Wrong address',
];
const NOTE_LIMIT = 300;

type Phase = 'loading' | 'failed' | 'rate' | 'done';

@Component({
  selector: 'app-delivery-rating',
  imports: [NgIcon],
  viewProviders: [
    provideIcons({
      solarStarBold,
      solarStarLinear,
      solarCheckCircleBoldDuotone,
      solarDangerCircleBoldDuotone,
      solarPenBoldDuotone,
    }),
  ],
  templateUrl: './delivery-rating.html',
  styleUrls: ['../../../../shared/styles/forms.css', './delivery-rating.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeliveryRatingCard {
  private readonly api = inject(DeliveryRatingService);
  private readonly toast = inject(ToastService);
  private readonly haptics = inject(HapticsService);

  readonly trackingId = input.required<string>();
  readonly courierName = input<string | null>(null);
  readonly deliveredLabel = input<string | null>(null);
  readonly rated = output<DeliveryRating>();

  protected readonly stars = [1, 2, 3, 4, 5];
  protected readonly noteLimit = NOTE_LIMIT;
  protected readonly phase = signal<Phase>('loading');
  protected readonly score = signal(0);
  protected readonly preview = signal(0);
  protected readonly tags = signal<readonly string[]>([]);
  protected readonly note = signal('');
  protected readonly saving = signal(false);
  protected readonly saved = signal<DeliveryRating | null>(null);
  protected readonly editing = computed(() => this.saved() !== null);

  protected readonly courier = computed(() => this.courierName() || 'your courier');
  /** Stars light up to the hovered star while pointing, otherwise to the chosen score. */
  protected readonly lit = computed(() => this.preview() || this.score());
  protected readonly verdict = computed(() => (this.lit() ? VERDICTS[this.lit() - 1] : null));
  protected readonly positive = computed(() => this.score() >= 4);
  protected readonly options = computed(() => (this.positive() ? PRAISE : ISSUES));
  protected readonly savedVerdict = computed(() => {
    const rating = this.saved();
    return rating ? VERDICTS[rating.score - 1] : '';
  });

  constructor() {
    effect(() => {
      const trackingId = this.trackingId();
      untracked(() => void this.load(trackingId));
    });
  }

  protected async load(trackingId = this.trackingId()): Promise<void> {
    this.phase.set('loading');
    try {
      const rating = await this.api.get(trackingId);
      this.saved.set(rating);
      this.phase.set(rating ? 'done' : 'rate');
    } catch {
      this.phase.set('failed');
    }
  }

  protected pick(value: number): void {
    // Praise and problems are different lists, so crossing the 3/4 line clears the picks.
    if (value >= 4 !== this.score() >= 4) this.tags.set([]);
    this.score.set(value);
    this.haptics.selection();
  }

  protected toggleTag(tag: string): void {
    this.tags.update((list) =>
      list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag],
    );
    this.haptics.selection();
  }

  protected onNote(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value.slice(0, NOTE_LIMIT));
  }

  protected edit(): void {
    const rating = this.saved();
    if (!rating) return;
    this.score.set(rating.score);
    this.tags.set([]);
    this.note.set(rating.comment);
    this.phase.set('rate');
    this.haptics.light();
  }

  protected cancelEdit(): void {
    this.phase.set('done');
    this.preview.set(0);
  }

  protected async submit(): Promise<void> {
    if (!this.score() || this.saving()) return;
    this.saving.set(true);
    this.haptics.light();
    // The API stores one free-text comment, so the quick picks travel inside it.
    const comment = [this.tags().join(', '), this.note().trim()].filter(Boolean).join('. ');
    try {
      const rating = await this.api.save(
        this.trackingId(),
        { score: this.score(), comment },
        this.editing(),
      );
      const updated = this.editing();
      this.saved.set(rating);
      this.phase.set('done');
      this.rated.emit(rating);
      this.toast.success(updated ? 'Rating updated' : 'Thanks for rating', {
        description: `You gave ${this.courier()} ${rating.score} out of 5.`,
      });
      this.haptics.success();
    } catch (error) {
      this.toast.error("Couldn't send your rating", {
        description: (error as Error).message,
        actions: [{ label: 'Try again', run: () => void this.submit() }],
      });
      this.haptics.error();
    } finally {
      this.saving.set(false);
    }
  }

  protected starLabel(value: number): string {
    return `${value} out of 5, ${VERDICTS[value - 1]}`;
  }
}
