import { AfterViewInit, Component, ElementRef, PLATFORM_ID, inject, OnDestroy, viewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Card } from '../card/card';
import { HapticsService } from '../../services/haptics.service';

interface AudienceItem {
  image: string;
  title: string;
  description: string;
}

/** Pixels per animation frame — desktop-only; touch devices use native momentum. */
const AUTO_SCROLL_SPEED = 0.5;
const SCROLL_SETTLE_MS = 180;

@Component({
  selector: 'app-audience',
  standalone: true,
  imports: [Card],
  templateUrl: './audience.html',
  styleUrl: './audience.css',
})
export class Audience implements AfterViewInit, OnDestroy {
  private readonly haptics = inject(HapticsService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly track = viewChild.required<ElementRef<HTMLElement>>('track');

  protected readonly items: AudienceItem[] = [
    {
      image: '/home/everyday-customer.png',
      title: 'Everyday Customers',
      description:
        'People who need to send packages, documents, food items, gifts, or personal deliveries across the city.',
    },
    {
      image: '/home/online-store.png',
      title: 'Online Stores',
      description:
        'Instagram vendors, Shopify stores, small e-commerce brands, and sellers who need reliable delivery after checkout.',
    },
    {
      image: '/home/retail-business.png',
      title: 'Retail Businesses',
      description:
        'Physical stores that want to offer delivery to customers without manually coordinating every order.',
    },
    {
      image: '/home/restaurants-food.png',
      title: 'Restaurants & Vendors',
      description: 'Food businesses that need fast pickup, delivery tracking, and customer updates.',
    },
    {
      image: '/home/courier-companies.png',
      title: 'Courier Companies',
      description:
        'Delivery businesses that need more customer demand, better order visibility, and smoother dispatch operations.',
    },
    {
      image: '/home/dispatch-riders.png',
      title: 'Dispatch Riders',
      description: 'Riders who receive delivery tasks, follow routes, update statuses, and complete deliveries.',
    },
  ];

  /** Three sets let touch and arrow navigation loop in either direction from the middle set. */
  protected readonly loopItems: AudienceItem[] = [...this.items, ...this.items, ...this.items];

  private rafId: number | null = null;
  private paused = false;
  private interacting = false;
  private arrowNavigating = false;
  private initialized = false;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private loopWidth = 0;
  private autoEnabled = false;
  /** Own float accumulator — reading back scrollLeft rounds to int and can stall a <1px/frame drift. */
  private position = 0;

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const touchCapable = navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
    this.autoEnabled = !reducedMotion && !touchCapable;

    requestAnimationFrame(this.measure);
    window.addEventListener('resize', this.measure);
    if (this.autoEnabled) this.rafId = requestAnimationFrame(this.tick);
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.settleTimer !== null) clearTimeout(this.settleTimer);
    window.removeEventListener('resize', this.measure);
  }

  /** Distance of one full item set (incl. gaps) — the seamless loop period. */
  private measure = (): void => {
    const el = this.track().nativeElement;
    const first = el.children[0] as HTMLElement | undefined;
    const firstClone = el.children[this.items.length] as HTMLElement | undefined;
    if (!first || !firstClone) return;

    const previousLoopWidth = this.loopWidth;
    const previousOffset = previousLoopWidth > 0
      ? ((el.scrollLeft % previousLoopWidth) + previousLoopWidth) % previousLoopWidth
      : 0;
    this.loopWidth = firstClone.offsetLeft - first.offsetLeft;
    if (this.loopWidth <= 0) return;

    const scaledOffset = previousLoopWidth > 0
      ? previousOffset * (this.loopWidth / previousLoopWidth)
      : 0;
    this.jumpWithoutAnimation(this.loopWidth + scaledOffset);
    this.initialized = true;
  };

  private tick = (): void => {
    if (this.autoEnabled && !this.paused && this.loopWidth > 0) {
      this.position += AUTO_SCROLL_SPEED;
      if (this.position >= this.loopWidth * 2) this.position -= this.loopWidth;
      this.track().nativeElement.scrollLeft = this.position;
    }
    this.rafId = requestAnimationFrame(this.tick);
  };

  protected pauseAuto(): void {
    this.paused = true;
  }

  protected resumeAuto(): void {
    if (this.interacting || this.arrowNavigating) return;
    this.normalizeLoopPosition();
    this.position = this.track().nativeElement.scrollLeft;
    this.paused = false;
  }

  protected beginInteraction(): void {
    this.interacting = true;
    this.paused = true;
    if (this.settleTimer !== null) clearTimeout(this.settleTimer);
  }

  protected endInteraction(): void {
    this.interacting = false;
    this.scheduleSettle();
  }

  protected onTrackScroll(): void {
    if (!this.initialized) return;
    if (this.autoEnabled && !this.paused && !this.arrowNavigating) return;
    this.position = this.track().nativeElement.scrollLeft;
    this.scheduleSettle();
  }

  protected scrollByAmount(direction: 1 | -1): void {
    const el = this.track().nativeElement;
    this.paused = true;
    this.arrowNavigating = true;
    this.normalizeLoopPosition();
    const cardWidth = el.querySelector<HTMLElement>('.audience__item')?.offsetWidth ?? 400;
    const styles = getComputedStyle(el);
    const gap = Number.parseFloat(styles.columnGap || styles.gap) || 40;
    el.scrollBy({ left: direction * (cardWidth + gap), behavior: 'smooth' });
    this.scheduleSettle();
    this.haptics.selection();
  }

  private scheduleSettle(): void {
    if (this.settleTimer !== null) clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      if (this.interacting) return;
      this.normalizeLoopPosition();
      this.position = this.track().nativeElement.scrollLeft;
      this.arrowNavigating = false;
      this.paused = false;
      this.settleTimer = null;
    }, SCROLL_SETTLE_MS);
  }

  /** Re-centres to the identical card set only after native momentum/smooth scrolling settles. */
  private normalizeLoopPosition(): void {
    if (this.loopWidth <= 0) return;
    const current = this.track().nativeElement.scrollLeft;
    if (current < this.loopWidth * 0.5) {
      this.jumpWithoutAnimation(current + this.loopWidth);
    } else if (current >= this.loopWidth * 1.5) {
      this.jumpWithoutAnimation(current - this.loopWidth);
    }
  }

  private jumpWithoutAnimation(left: number): void {
    const el = this.track().nativeElement;
    el.scrollTo({ left, behavior: 'auto' });
    this.position = left;
  }
}
