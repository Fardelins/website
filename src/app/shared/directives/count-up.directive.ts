import { isPlatformBrowser } from '@angular/common';
import {
  Directive,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  effect,
  inject,
  input,
} from '@angular/core';

const DURATION_MS = 900;

/**
 * Counts an element's text from zero up to `appCountUp`. `prefix`/`suffix` wrap the
 * number so currency and units survive the animation.
 */
@Directive({ selector: '[appCountUp]' })
export class CountUpDirective implements OnDestroy {
  readonly appCountUp = input.required<number>();
  readonly appCountUpPrefix = input('');
  readonly appCountUpSuffix = input('');
  /** Decimal places; money needs 2, parcel counts need 0. */
  readonly appCountUpDecimals = input(0);

  private readonly el = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private rafId: number | null = null;

  constructor() {
    effect(() => {
      const target = this.appCountUp();
      if (!this.isBrowser || matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.render(target);
        return;
      }
      this.animateTo(target);
    });
  }

  ngOnDestroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
  }

  private animateTo(target: number): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    const start = performance.now();
    const step = (now: number): void => {
      const t = Math.min((now - start) / DURATION_MS, 1);
      // easeOutExpo: fast off the mark, long settle, so the last digits land gently.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      this.render(target * eased);
      this.rafId = t < 1 ? requestAnimationFrame(step) : null;
    };
    this.rafId = requestAnimationFrame(step);
  }

  private render(value: number): void {
    const decimals = this.appCountUpDecimals();
    const formatted = value.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    this.el.textContent = `${this.appCountUpPrefix()}${formatted}${this.appCountUpSuffix()}`;
  }
}
