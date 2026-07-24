import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';

const STORAGE_KEY = 'fardelins-cookie-consent';
// Bump when the categories or policy change so every visitor is re-asked.
const CONSENT_VERSION = 1;

export type ConsentCategory = 'necessary' | 'analytics';

export interface ConsentPreferences {
  /** Always on: essential for the site to function; can't be declined. */
  necessary: true;
  analytics: boolean;
}

interface StoredConsent {
  version: number;
  preferences: ConsentPreferences;
  updatedAt: string;
}

const DEFAULT_PREFERENCES: ConsentPreferences = { necessary: true, analytics: false };

/**
 * Cookie-consent state: reads/writes the saved choice and exposes per-category
 * grants. GDPR opt-in — nothing beyond `necessary` is granted until the visitor
 * chooses. Wire third-party scripts (e.g. analytics) to `analyticsGranted`.
 */
@Injectable({ providedIn: 'root' })
export class ConsentService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly stored = signal<StoredConsent | null>(this.read());
  private readonly reopened = signal(false);

  /** Whether the banner should be shown: no decision yet, or re-opened from the footer. */
  readonly bannerVisible = computed(() => this.stored() === null || this.reopened());

  readonly preferences = computed<ConsentPreferences>(
    () => this.stored()?.preferences ?? DEFAULT_PREFERENCES,
  );

  // === Hook analytics/marketing scripts to these grants ===
  // e.g. effect(() => { if (consent.analyticsGranted()) loadGtag(); });
  readonly analyticsGranted = computed(() => this.preferences().analytics);

  acceptAll(): void {
    this.persist({ necessary: true, analytics: true });
  }

  rejectAll(): void {
    this.persist({ necessary: true, analytics: false });
  }

  save(preferences: Partial<ConsentPreferences>): void {
    this.persist({ ...DEFAULT_PREFERENCES, ...preferences, necessary: true });
  }

  /** Re-open the banner (e.g. a "Cookie preferences" footer link) without clearing the saved choice. */
  reopen(): void {
    this.reopened.set(true);
  }

  private persist(preferences: ConsentPreferences): void {
    const record: StoredConsent = {
      version: CONSENT_VERSION,
      preferences,
      updatedAt: new Date().toISOString(),
    };
    this.stored.set(record);
    this.reopened.set(false);
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    } catch {
      // Storage blocked (private mode / quota): the choice still holds in-memory for this session.
    }
  }

  private read(): StoredConsent | null {
    if (!this.isBrowser) return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as StoredConsent;
      if (parsed?.version !== CONSENT_VERSION) return null; // outdated schema → re-ask
      return parsed;
    } catch {
      return null;
    }
  }
}
