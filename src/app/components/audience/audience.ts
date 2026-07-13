import { AfterViewInit, Component, ElementRef, PLATFORM_ID, inject, OnDestroy, viewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Card } from '../card/card';
import { HapticsService } from '../../services/haptics.service';

interface AudienceItem {
  image: string;
  title: string;
  description: string;
}

/** Pixels per animation frame — ~0.5 at 60fps ≈ 30px/s, a slow drift. */
const AUTO_SCROLL_SPEED = 0.5;

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

  /** Items rendered twice so the auto-scroll can wrap back seamlessly. */
  protected readonly loopItems: AudienceItem[] = [...this.items, ...this.items];

  private rafId: number | null = null;
  private paused = false;
  private loopWidth = 0;
  /** Own float accumulator — reading back scrollLeft rounds to int and can stall a <1px/frame drift. */
  private position = 0;

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.measure();
    window.addEventListener('resize', this.measure);
    this.rafId = requestAnimationFrame(this.tick);
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    window.removeEventListener('resize', this.measure);
  }

  /** Distance of one full item set (incl. gaps) — the seamless loop period. */
  private measure = (): void => {
    const el = this.track().nativeElement;
    const first = el.children[0] as HTMLElement | undefined;
    const firstClone = el.children[this.items.length] as HTMLElement | undefined;
    if (first && firstClone) this.loopWidth = firstClone.offsetLeft - first.offsetLeft;
  };

  private tick = (): void => {
    if (!this.paused && this.loopWidth > 0) {
      this.position += AUTO_SCROLL_SPEED;
      if (this.position >= this.loopWidth) this.position -= this.loopWidth;
      this.track().nativeElement.scrollLeft = this.position;
    }
    this.rafId = requestAnimationFrame(this.tick);
  };

  protected pauseAuto(): void {
    this.paused = true;
  }

  protected resumeAuto(): void {
    // Pick up wherever the user (arrows or drag) left the scroll before resuming the drift.
    this.position = this.track().nativeElement.scrollLeft;
    this.paused = false;
  }

  protected scrollByAmount(direction: 1 | -1): void {
    const el = this.track().nativeElement;
    const cardWidth = el.querySelector<HTMLElement>('.audience__item')?.offsetWidth ?? 400;
    const gap = 40;
    el.scrollBy({ left: direction * (cardWidth + gap), behavior: 'smooth' });
    this.haptics.selection();
  }
}
