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
    const text = this.trackingId();
    const done = (await this.writeClipboard(text)) || this.copyWithSelection(text);
    this.copied.set(done);
    clearTimeout(this.resetTimer);
    if (done) this.resetTimer = setTimeout(() => this.copied.set(false), COPIED_RESET_MS);
  }

  private async writeClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  /** Pages without the async clipboard (a non-secure address, older Safari) still copy this way. */
  private copyWithSelection(text: string): boolean {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.append(field);
    field.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      field.remove();
    }
  }
}
