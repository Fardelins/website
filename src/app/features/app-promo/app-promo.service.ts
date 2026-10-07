import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { APP_DOWNLOAD_CONFIG } from '@core/config/app-download.config';
import { AuthService } from '@core/auth/auth.service';
import { injectLogisticsApiUrl } from '@core/services/logistics-api.config';
import { AppPromoTrigger, ONE_SHOT_TRIGGERS } from './app-promo.model';

const STORAGE_PREFIX = 'fardelins.app-promo.';
const DAY_MS = 86_400_000;
const QUIET_PERIOD_MS = 14 * DAY_MS;
const SNOOZE_MS = 30 * DAY_MS;
const RETIRE_AFTER_DISMISSALS = 2;
/** Let the page that triggered this finish landing before anything covers it. */
const SETTLE_MS = 900;

export type AppPromoOutcome = 'not-now' | 'dismiss' | 'accept';

interface PromoState {
  dismissals: number;
  retired: boolean;
  lastShownAt: number | null;
  snoozedUntil: number | null;
  fired: AppPromoTrigger[];
}

const EMPTY_STATE: PromoState = {
  dismissals: 0,
  retired: false,
  lastShownAt: null,
  snoozedUntil: null,
  fired: [],
};

/**
 * Owns when the app-download prompt may appear. Call sites report a moment,
 * never a decision, so the cadence lives in exactly one place.
 */
@Injectable({ providedIn: 'root' })
export class AppPromoService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly apiUrl = injectLogisticsApiUrl();

  private shownThisSession = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  readonly active = signal<AppPromoTrigger | null>(null);
  readonly linkSent = signal(false);

  /** Report a moment worth pitching the app at. The cadence decides the rest. */
  request(trigger: AppPromoTrigger): void {
    if (!this.isBrowser || !this.eligible(trigger)) return;

    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.active() || !this.eligible(trigger)) return;
      this.show(trigger);
    }, SETTLE_MS);
  }

  /** User asked for it, so cadence does not apply. `trigger` lets a preview control pick the copy. */
  open(trigger: AppPromoTrigger = 'manual'): void {
    this.clearTimer();
    this.linkSent.set(false);
    this.active.set(trigger);
  }

  resolve(outcome: AppPromoOutcome): void {
    const trigger = this.active();
    this.active.set(null);
    this.linkSent.set(false);
    if (!trigger || trigger === 'manual') return;

    const state = this.read();
    if (outcome === 'accept') {
      this.write({ ...state, retired: true });
      return;
    }

    const dismissals = state.dismissals + 1;
    this.write({
      ...state,
      dismissals,
      retired: dismissals >= RETIRE_AFTER_DISMISSALS,
      snoozedUntil: outcome === 'not-now' ? Date.now() + SNOOZE_MS : state.snoozedUntil,
    });
  }

  async sendLink(phone: string): Promise<void> {
    await firstValueFrom(
      this.http.post(this.apiUrl(APP_DOWNLOAD_CONFIG.sendLink.endpoint), { phone }),
    );
    this.linkSent.set(true);
  }

  private show(trigger: AppPromoTrigger): void {
    this.shownThisSession = true;
    const state = this.read();
    this.write({
      ...state,
      lastShownAt: Date.now(),
      fired: ONE_SHOT_TRIGGERS.has(trigger) ? [...state.fired, trigger] : state.fired,
    });
    this.linkSent.set(false);
    this.active.set(trigger);
  }

  private eligible(trigger: AppPromoTrigger): boolean {
    if (this.shownThisSession || trigger === 'manual') return false;

    const state = this.read();
    if (state.retired) return false;
    if (ONE_SHOT_TRIGGERS.has(trigger) && state.fired.includes(trigger)) return false;

    const now = Date.now();
    if (state.snoozedUntil && now < state.snoozedUntil) return false;
    return !state.lastShownAt || now - state.lastShownAt >= QUIET_PERIOD_MS;
  }

  // Keyed per account: a second user on this browser starts with a clean slate.
  private get storageKey(): string {
    return STORAGE_PREFIX + (this.auth.user()?.id ?? 'guest');
  }

  private read(): PromoState {
    if (!this.isBrowser) return EMPTY_STATE;
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? { ...EMPTY_STATE, ...(JSON.parse(raw) as Partial<PromoState>) } : EMPTY_STATE;
    } catch {
      return EMPTY_STATE;
    }
  }

  private write(state: PromoState): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(state));
    } catch {
      // Private browsing: the session guard alone still keeps this polite.
    }
  }

  private clearTimer(): void {
    if (this.timer === null) return;
    clearTimeout(this.timer);
    this.timer = null;
  }
}
