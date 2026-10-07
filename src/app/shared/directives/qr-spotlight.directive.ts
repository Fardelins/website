import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
  OnDestroy,
  PLATFORM_ID,
  inject,
} from '@angular/core';

const SPOTLIGHT_EASE = 0.24;
const SETTLE_THRESHOLD = 0.001;

/**
 * Cursor-follow spotlight + rainbow shimmer for a QR plate. Writes `--mx`, `--my`,
 * `--spotlight-opacity` and `--rainbow-opacity` onto the host, matching the QR sign-in
 * plate's own stylesheet contract, so any QR surface can opt into the same treatment.
 */
@Directive({
  selector: '[appQrSpotlight]',
  standalone: true,
})
export class QrSpotlightDirective implements AfterViewInit, OnDestroy {
  /** 'parent' reads pointer position off the untilted frame, so tilt cannot feed back into it. */
  @Input() appQrSpotlightSurface: 'self' | 'parent' = 'self';

  private readonly el = inject(ElementRef<HTMLElement>).nativeElement;
  private interactionSurface: HTMLElement | null = null;
  private target = { x: 0.5, y: 0.5 };
  private current = { x: 0.5, y: 0.5 };
  private rafId: number | null = null;
  private enabled = false;

  private readonly onPointerMove = (event: PointerEvent): void => {
    const rect = this.interactionSurface?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    this.target = {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
    this.setOpacity(1);
    this.startLoop();
  };

  private readonly onPointerLeave = (): void => {
    this.target = { x: 0.5, y: 0.5 };
    this.setOpacity(0);
    this.startLoop();
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') this.onPointerLeave();
  };

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    this.enabled = true;
  }

  ngAfterViewInit(): void {
    if (!this.enabled) return;
    this.interactionSurface =
      this.appQrSpotlightSurface === 'parent' ? this.el.parentElement : this.el;
    this.interactionSurface?.addEventListener('pointerdown', this.onPointerMove);
    this.interactionSurface?.addEventListener('pointermove', this.onPointerMove);
    this.interactionSurface?.addEventListener('pointerleave', this.onPointerLeave);
    this.interactionSurface?.addEventListener('pointercancel', this.onPointerLeave);
    this.interactionSurface?.addEventListener('pointerup', this.onPointerUp);
  }

  ngOnDestroy(): void {
    if (!this.enabled) return;
    this.interactionSurface?.removeEventListener('pointerdown', this.onPointerMove);
    this.interactionSurface?.removeEventListener('pointermove', this.onPointerMove);
    this.interactionSurface?.removeEventListener('pointerleave', this.onPointerLeave);
    this.interactionSurface?.removeEventListener('pointercancel', this.onPointerLeave);
    this.interactionSurface?.removeEventListener('pointerup', this.onPointerUp);
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
  }

  private setOpacity(value: 0 | 1): void {
    this.el.style.setProperty('--spotlight-opacity', String(value));
    this.el.style.setProperty('--rainbow-opacity', String(value));
  }

  private startLoop(): void {
    if (this.rafId !== null) return;
    const step = (): void => {
      this.current.x += (this.target.x - this.current.x) * SPOTLIGHT_EASE;
      this.current.y += (this.target.y - this.current.y) * SPOTLIGHT_EASE;
      this.el.style.setProperty('--mx', `${this.current.x * 100}%`);
      this.el.style.setProperty('--my', `${this.current.y * 100}%`);
      const settled =
        Math.abs(this.target.x - this.current.x) < SETTLE_THRESHOLD &&
        Math.abs(this.target.y - this.current.y) < SETTLE_THRESHOLD;
      this.rafId = settled ? null : requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
