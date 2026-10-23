import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { QrSpotlightDirective } from '@shared/directives/qr-spotlight.directive';
import { TiltDirective } from '@shared/directives/tilt.directive';
import { QrGlyphs } from '@shared/utils/qr-glyphs';

/** The beat of skeleton before the first reveal, so the code doesn't just pop in. */
const SKELETON_MS = 620;
const LOGO_SIZE_MODULES = 7;

let nextPlate = 0;

/**
 * A QR code that resolves in as a dithered wave and answers the pointer with a tilt, a spotlight and a
 * rainbow shimmer: the same treatment as the QR sign-in plate. Size it with `--qr-size` (default 196px).
 */
@Component({
  selector: 'app-qr-plate',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, TiltDirective, QrSpotlightDirective],
  templateUrl: './qr-plate.html',
  styleUrl: './qr-plate.css',
})
export class QrPlate {
  readonly glyphs = input<QrGlyphs | null>(null);
  readonly label = input('QR code');

  protected readonly gradientId = `qrp-rainbow-${++nextPlate}`;
  protected readonly shown = signal<QrGlyphs | null>(null);
  protected readonly revealing = signal(false);
  protected readonly viewBox = computed(() => {
    const span = this.shown()?.span ?? 1;
    return `0 0 ${span} ${span}`;
  });
  protected readonly span = computed(() => this.shown()?.span ?? 1);
  /** The carved-out centre as a share of the code's width, so the logo sits exactly in it. */
  protected readonly logoPercent = computed(() => (LOGO_SIZE_MODULES / this.span()) * 100);

  private waiting = true;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const glyphs = this.glyphs();
      clearTimeout(this.timer);
      if (!glyphs) {
        this.shown.set(null);
        this.revealing.set(false);
        this.waiting = true;
        return;
      }
      if (this.waiting) {
        this.waiting = false;
        this.timer = setTimeout(() => {
          this.shown.set(glyphs);
          this.revealing.set(true);
        }, SKELETON_MS);
      } else {
        this.shown.set(glyphs);
      }
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }
}
