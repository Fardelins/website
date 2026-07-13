import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, OnDestroy, PLATFORM_ID, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AppPlatformService } from '../../services/app-platform.service';
import { HapticsService } from '../../services/haptics.service';

@Component({
  selector: 'app-download-prompt',
  standalone: true,
  templateUrl: './download-prompt.html',
  styleUrl: './download-prompt.css',
})
export class DownloadPrompt implements AfterViewInit, OnDestroy {
  private readonly appPlatform = inject(AppPlatformService);
  private readonly haptics = inject(HapticsService);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private observer: IntersectionObserver | null = null;
  private routeSubscription: Subscription | null = null;

  protected readonly visible = signal(false);
  protected readonly href = this.appPlatform.hrefFor();
  protected readonly external = Boolean(this.appPlatform.preferredStore?.url);
  protected readonly platformLabel = this.appPlatform.preferredStore
    ? `Available on ${this.appPlatform.preferredStore.name}`
    : 'Available on App Store & Google Play';

  ngAfterViewInit(): void {
    if (!this.isBrowser || typeof globalThis.IntersectionObserver === 'undefined') return;
    this.bindVisibility();
    this.routeSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => requestAnimationFrame(() => this.bindVisibility()));
  }

  private bindVisibility(): void {
    this.observer?.disconnect();
    const hero = this.document.querySelector<HTMLElement>('.hero');
    if (!hero || typeof globalThis.IntersectionObserver === 'undefined') {
      const path = this.router.url.split(/[?#]/, 1)[0];
      this.visible.set(path !== '/' && path !== '/home');
      return;
    }

    this.observer = new globalThis.IntersectionObserver(([entry]) => {
      this.visible.set(!entry.isIntersecting && entry.boundingClientRect.bottom <= 0);
    });
    this.observer.observe(hero);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.routeSubscription?.unsubscribe();
  }

  protected download(): void {
    this.haptics.light();
  }
}
