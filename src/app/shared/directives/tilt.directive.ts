import {
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
  OnDestroy,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const TILT_EASE = 0.12;
const TILT_PERSPECTIVE_PX = 800;
const SETTLE_THRESHOLD = 0.001;

/** 3D pointer-tilt on hover. `[appTilt]="degrees"` sets the max rotation. */
@Directive({
  selector: '[appTilt]',
  standalone: true,
})
export class TiltDirective implements AfterViewInit, OnDestroy {
  @Input('appTilt') maxTiltDeg = 10;
  @Input() appTiltSurface: 'self' | 'parent' = 'self';

  private readonly el = inject(ElementRef<HTMLElement>).nativeElement;
  private interactionSurface: HTMLElement | null = null;
  private target = { x: 0, y: 0 };
  private current = { x: 0, y: 0 };
  private rafId: number | null = null;

  private readonly onPointerMove = (event: PointerEvent): void => {
    const rect = this.interactionSurface?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    this.target = {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: ((event.clientY - rect.top) / rect.height) * 2 - 1,
    };
    this.startLoop();
  };

  private readonly onPointerLeave = (): void => {
    this.target = { x: 0, y: 0 };
    this.startLoop();
  };

  private enabled = false;

  constructor() {
    // Skip on the server (no pointer) and when the user prefers reduced motion.
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.enabled = true;
  }

  ngAfterViewInit(): void {
    if (!this.enabled) return;
    this.interactionSurface = this.appTiltSurface === 'parent' ? this.el.parentElement : this.el;
    this.interactionSurface?.addEventListener('pointermove', this.onPointerMove);
    this.interactionSurface?.addEventListener('pointerleave', this.onPointerLeave);
  }

  ngOnDestroy(): void {
    if (!this.enabled) return;
    this.interactionSurface?.removeEventListener('pointermove', this.onPointerMove);
    this.interactionSurface?.removeEventListener('pointerleave', this.onPointerLeave);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
  }

  private startLoop(): void {
    if (this.rafId !== null) {
      return;
    }
    const step = (): void => {
      this.current.x += (this.target.x - this.current.x) * TILT_EASE;
      this.current.y += (this.target.y - this.current.y) * TILT_EASE;

      const rotateY = this.current.x * this.maxTiltDeg;
      const rotateX = -this.current.y * this.maxTiltDeg;
      this.el.style.transform = `perspective(${TILT_PERSPECTIVE_PX}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;

      const settled =
        Math.abs(this.target.x - this.current.x) < SETTLE_THRESHOLD &&
        Math.abs(this.target.y - this.current.y) < SETTLE_THRESHOLD;
      this.rafId = settled ? null : requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }
}
