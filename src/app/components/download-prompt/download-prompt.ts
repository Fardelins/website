import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, OnDestroy, PLATFORM_ID, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { APP_DOWNLOAD_CONFIG } from '../../config/app-download.config';
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
  private heroPassed = false;
  private footerVisible = false;

  protected readonly visible = signal(false);
  protected readonly href = this.appPlatform.hrefFor();
  protected readonly external = Boolean(this.appPlatform.preferredStore?.url);
  protected readonly platformLabel = this.appPlatform.preferredStore
    ? this.appPlatform.preferredStore.url
      ? `Available on ${this.appPlatform.preferredStore.name}`
      : `Coming soon on ${this.appPlatform.preferredStore.name}`
    : Object.values(APP_DOWNLOAD_CONFIG.stores).some((store) => Boolean(store.url))
      ? 'Available on App Store and Google Play'
      : 'Coming soon on App Store and Google Play';
  protected readonly ctaLabel = this.external ? 'Download' : 'Learn more';

  ngAfterViewInit(): void {
    if (!this.isBrowser || typeof globalThis.IntersectionObserver === 'undefined') return;
    this.bindVisibility();
    this.routeSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => requestAnimationFrame(() => this.bindVisibility()));
  }

  private bindVisibility(): void {
    this.observer?.disconnect();
    const path = this.router.url.split(/[?#]/, 1)[0];

    if (path === APP_DOWNLOAD_CONFIG.route) {
      this.heroPassed = false;
      this.footerVisible = false;
      this.visible.set(false);
      return;
    }

    const hero = this.document.querySelector<HTMLElement>('.hero');
    const footer = this.document.querySelector<HTMLElement>('app-footer');
    const viewportHeight = this.document.defaultView?.innerHeight ?? 0;

    this.heroPassed = hero
      ? hero.getBoundingClientRect().bottom <= 0
      : path !== '/' && path !== '/home';

    if (footer) {
      const footerRect = footer.getBoundingClientRect();
      this.footerVisible = footerRect.top < viewportHeight && footerRect.bottom > 0;
    } else {
      this.footerVisible = false;
    }

    this.updateVisibility();

    this.observer = new globalThis.IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === hero) {
          this.heroPassed = !entry.isIntersecting && entry.boundingClientRect.bottom <= 0;
        }

        if (entry.target === footer) {
          this.footerVisible = entry.isIntersecting;
        }
      }

      this.updateVisibility();
    });

    if (hero) this.observer.observe(hero);
    if (footer) this.observer.observe(footer);
  }

  private updateVisibility(): void {
    this.visible.set(this.heroPassed && !this.footerVisible);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.routeSubscription?.unsubscribe();
  }

  protected download(): void {
    this.haptics.light();
  }
}
