import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarCheckCircleBoldDuotone,
  solarCopyBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { HapticsService } from '@core/services/haptics.service';

const COPIED_RESET_MS = 1600;

@Component({
  selector: 'app-tracking-copy',
  imports: [NgIcon],
  viewProviders: [provideIcons({ solarCheckCircleBoldDuotone, solarCopyBoldDuotone })],
  templateUrl: './tracking-copy.html',
  styleUrl: './tracking-copy.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackingCopy {
  private readonly haptics = inject(HapticsService);
  private resetTimer: ReturnType<typeof setTimeout> | undefined;
  private previousTrackingId = '';

  readonly trackingId = input.required<string>();
  readonly copiedText = input('Copied');
  protected readonly copied = signal(false);

  constructor() {
    effect(() => {
      const trackingId = this.trackingId();
      if (trackingId === this.previousTrackingId) return;
      this.previousTrackingId = trackingId;
      this.copied.set(false);
      clearTimeout(this.resetTimer);
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.resetTimer));
  }

  protected async copy(): Promise<void> {
    this.haptics.selection();
    try {
      await navigator.clipboard.writeText(this.trackingId());
      this.copied.set(true);
      clearTimeout(this.resetTimer);
      this.resetTimer = setTimeout(() => this.copied.set(false), COPIED_RESET_MS);
    } catch {
      this.copied.set(false);
    }
  }
}
