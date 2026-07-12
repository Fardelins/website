import { Component, OnDestroy, afterNextRender } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './components/navbar/navbar';
import { Footer } from './components/footer/footer';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnDestroy {
  /** <1 slows the perceived scroll speed, >1 speeds it up. */
  private readonly speed = 0.6;
  /** Lower = smoother/heavier catch-up toward the target position. */
  private readonly ease = 0.09;
  /** How long (ms) after the last wheel tick before we hand control back to native scroll (keys, scrollbar, touch). */
  private readonly idleTimeout = 200;

  private targetY = 0;
  private currentY = 0;
  private lastWheelTime = 0;
  private rafId = 0;

  constructor() {
    afterNextRender(() => this.initSmoothScroll());
  }

  private initSmoothScroll(): void {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    this.currentY = window.scrollY;
    this.targetY = window.scrollY;

    window.addEventListener('wheel', this.onWheel, { passive: false });
    this.rafId = requestAnimationFrame(this.tick);
  }

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.lastWheelTime = performance.now();

    this.targetY += event.deltaY * this.speed;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    this.targetY = Math.min(Math.max(this.targetY, 0), max);
  };

  private tick = (): void => {
    const idle = performance.now() - this.lastWheelTime > this.idleTimeout;

    if (idle) {
      // No recent wheel input — stay in sync with native scroll (keyboard, scrollbar, touch).
      this.currentY = window.scrollY;
      this.targetY = window.scrollY;
    } else {
      this.currentY += (this.targetY - this.currentY) * this.ease;
      window.scrollTo(0, this.currentY);
    }

    this.rafId = requestAnimationFrame(this.tick);
  };

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('wheel', this.onWheel);
  }
}
