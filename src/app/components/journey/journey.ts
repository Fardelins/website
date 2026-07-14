import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { StoreBadges } from '../store-badges/store-badges';

interface JourneyPanel {
  theme: 'purple' | 'dark' | 'blue';
  textTone: 'light' | 'dark';
  chip: string;
  title: string;
  description: string;
  phone: string;
  phoneAlt: string;
  cta: 'badges' | 'button';
  ctaLabel?: string;
}

@Component({
  selector: 'app-journey',
  standalone: true,
  imports: [StoreBadges, NgTemplateOutlet],
  templateUrl: './journey.html',
  styleUrl: './journey.css',
})
export class Journey implements AfterViewInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  @ViewChild('scrollShell')
  private readonly scrollShell?: ElementRef<HTMLElement>;

  protected readonly panels: JourneyPanel[] = [
    {
      theme: 'purple',
      textTone: 'light',
      chip: 'Customers',
      title: 'Send, track, and manage deliveries from one simple app.',
      description:
        'Request pickups, follow deliveries live, receive status updates, and view your delivery history without calling back and forth.',
      phone: '/home/customer-phone-600.webp',
      phoneAlt: 'Fardelins customer delivery app',
      cta: 'badges',
    },
    {
      theme: 'dark',
      textTone: 'light',
      chip: 'Storefront',
      title: 'Turn customer orders into smooth deliveries.',
      description:
        'Connect your store, manage fulfillment, and give customers real-time visibility from checkout to delivery.',
      phone: '/home/storefront-phone-600.webp',
      phoneAlt: 'Fardelins storefront order management app',
      cta: 'badges',
    },
    {
      theme: 'blue',
      textTone: 'dark',
      chip: 'Courier & Dispatchers',
      title: 'Coordinate deliveries with better visibility.',
      description:
        'Assign deliveries, monitor active routes, update delivery progress, and keep teams aligned in real time.',
      phone: '/home/courier-phone-600.webp',
      phoneAlt: 'Fardelins courier and dispatcher app',
      cta: 'button',
      ctaLabel: 'Join as a Courier',
    },
  ];

  protected readonly activeIndex = signal(0);
  protected readonly activePanel = computed(() => this.panels[this.activeIndex()]);
  protected readonly slideDirection = signal<'forward' | 'backward'>('forward');

  private reducedMotion = false;
  private scrollRaf: number | null = null;

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    this.reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    globalThis.addEventListener('scroll', this.onScroll, { passive: true });
    globalThis.addEventListener('resize', this.onResize, { passive: true });
    this.updateActiveState();
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;
    globalThis.removeEventListener('scroll', this.onScroll);
    globalThis.removeEventListener('resize', this.onResize);
    if (this.scrollRaf !== null) cancelAnimationFrame(this.scrollRaf);
  }

  protected goToPanel(index: number): void {
    const shell = this.scrollShell?.nativeElement;
    if (!shell || !this.isBrowser) return;

    const stickyOffset = this.getStickyOffset();
    const shellTop = globalThis.scrollY + shell.getBoundingClientRect().top;
    const travel = Math.max(shell.offsetHeight - globalThis.innerHeight, 0);
    const progress = this.panels.length > 1 ? index / (this.panels.length - 1) : 0;

    globalThis.scrollTo({
      top: shellTop - stickyOffset + travel * progress,
      behavior: this.reducedMotion ? 'auto' : 'smooth',
    });
  }

  private readonly onScroll = (): void => this.scheduleStateUpdate();
  private readonly onResize = (): void => this.scheduleStateUpdate();

  private scheduleStateUpdate(): void {
    if (this.scrollRaf !== null) return;
    this.scrollRaf = requestAnimationFrame(() => {
      this.scrollRaf = null;
      this.updateActiveState();
    });
  }

  private updateActiveState(): void {
    const shell = this.scrollShell?.nativeElement;
    if (!shell) return;

    // Mobile renders a plain stacked list (the sticky shell is hidden via CSS),
    // so there's no scroll-driven active panel to compute.
    if (globalThis.innerWidth <= 640) return;

    const travel = Math.max(shell.offsetHeight - globalThis.innerHeight, 1);
    const progress = Math.min(
      Math.max((this.getStickyOffset() - shell.getBoundingClientRect().top) / travel, 0),
      1,
    );
    const nextIndex = Math.round(progress * (this.panels.length - 1));

    if (nextIndex !== this.activeIndex()) {
      this.slideDirection.set(nextIndex > this.activeIndex() ? 'forward' : 'backward');
      this.activeIndex.set(nextIndex);
    }
  }

  private getStickyOffset(): number {
    return globalThis.innerWidth <= 900 ? 76 : 96;
  }
}
