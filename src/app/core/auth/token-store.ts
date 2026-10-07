import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { DashboardPreferencesService } from '@core/services/dashboard-preferences.service';
import { AuthSession, AuthUser } from './auth.models';

const REFRESH_KEY = 'fardelins.refresh';
const USER_KEY = 'fardelins.user';

/**
 * Holds the session. The access token stays in memory only, it never reaches localStorage,
 * so an XSS payload can't read it back after a reload. The refresh token has to persist for
 * "stay signed in" to work at all; swap this for httpOnly cookies if the API ever sets them.
 */
@Injectable({ providedIn: 'root' })
export class TokenStore {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly preferences = inject(DashboardPreferencesService);
  private accessToken: string | null = null;

  readonly user = signal<AuthUser | null>(null);
  readonly ready = signal(false);

  constructor() {
    if (this.isBrowser) this.user.set(this.read<AuthUser>(USER_KEY));
    this.ready.set(true);
  }

  get token(): string | null {
    return this.accessToken;
  }

  get refreshToken(): string | null {
    return this.isBrowser ? (localStorage.getItem(REFRESH_KEY) ?? null) : null;
  }

  /** True when a refresh token exists, so the app can attempt a silent restore on boot. */
  get restorable(): boolean {
    return Boolean(this.refreshToken);
  }

  save(session: AuthSession): void {
    this.accessToken = session.accessToken;
    if (session.user) this.setUser(session.user);
    if (!this.isBrowser) return;
    if (session.refreshToken) localStorage.setItem(REFRESH_KEY, session.refreshToken);
  }

  setUser(user: AuthUser): void {
    this.user.set(user);
    this.write(USER_KEY, user);
  }

  /** Both the sign-out button and a failed silent refresh land here, so it owns the reset. */
  clear(): void {
    this.accessToken = null;
    this.user.set(null);
    // The dashboard's theme is per-session; signed out, everything goes back to light.
    this.preferences.setTheme('light');
    if (!this.isBrowser) return;
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  }

  private read<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Private mode / quota, the session still works for this tab.
    }
  }
}
