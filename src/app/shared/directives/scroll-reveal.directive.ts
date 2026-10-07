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

/**
 * Adds a class to the host once it scrolls into view, then disconnects, a one-shot
 * reveal, not a repeating scroll-spy. Reduced-motion / motion-off is handled in CSS
 * (matching `.dash-in`/`.row-in`), not here, the class is still added on schedule,
 * just with the transition neutralized.
 */
@Directive({
  selector: '[appScrollReveal]',
  standalone: true,
})
export class ScrollRevealDirective implements AfterViewInit, OnDestroy {
  // Deliberately NOT aliased to the selector name: a bare `appScrollReveal` attribute
  // (no `="..."`) resolves to an empty-string binding, not "leave the default", that
  // silently broke classList.add() here once already. Keep it a separate, plain input.
  @Input() revealClass = 'revealed';
  @Input() scrollRevealThreshold = 0.2;

  private readonly el = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private observer: IntersectionObserver | null = null;

  ngAfterViewInit(): void {
    if (!this.isBrowser || typeof IntersectionObserver === 'undefined') {
      this.el.classList.add(this.revealClass);
      return;
    }
    this.observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        this.el.classList.add(this.revealClass);
        this.observer?.disconnect();
        this.observer = null;
      },
      { threshold: this.scrollRevealThreshold },
    );
    this.observer.observe(this.el);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
