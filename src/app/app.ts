import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, DestroyRef, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { Navbar } from './layout/navbar/navbar';
import { Footer } from './layout/footer/footer';
import { DownloadPrompt } from './layout/download-prompt/download-prompt';
import { CookieConsent } from './layout/cookie-consent/cookie-consent';

const OWN_CHROME = /^\/(app|login|signup|forgot-password|reset-password)(\/|$)/;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer, DownloadPrompt, CookieConsent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private previousRouteUrl: string | null = null;

  // The app and auth sections carry their own chrome, the marketing nav/footer would fight it.
  // Seeded from the browser's URL, not `router.url`, which is still '/' on first paint because
  // initial navigation hasn't resolved yet, that lag was flashing the marketing nav.
  private readonly currentUrl = signal(
    this.isBrowser ? this.document.location.pathname : this.router.url.split(/[?#]/, 1)[0],
  );
  protected readonly hideChrome = computed(() => OWN_CHROME.test(this.currentUrl()));

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects.split(/[?#]/, 1)[0]);
        this.handleNavigationEnd(event);
      });
  }

  protected focusMainContent(event?: Event): void {
    event?.preventDefault();
    const main = this.document.getElementById('main-content');
    main?.focus();
  }

  private handleNavigationEnd(event: NavigationEnd): void {
    const routeUrl = event.urlAfterRedirects.split('#', 1)[0];

    // Initial document navigation is announced by the browser. Manage focus
    // only for subsequent SPA navigations, and leave fragment jumps alone.
    if (this.previousRouteUrl === null) {
      this.previousRouteUrl = routeUrl;
      return;
    }
    if (routeUrl === this.previousRouteUrl || !this.isBrowser) return;
    this.previousRouteUrl = routeUrl;

    this.document.defaultView?.requestAnimationFrame(() => this.focusRouteContent());
  }

  private focusRouteContent(): void {
    const main = this.document.getElementById('main-content');
    if (!main) return;

    const heading = main.querySelector<HTMLElement>('h1:not([aria-hidden="true"])');
    const target = heading ?? main;
    if (heading) heading.tabIndex = -1;
    target.focus({ preventScroll: true });
  }
}
