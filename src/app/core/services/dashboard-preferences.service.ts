import { isPlatformBrowser } from '@angular/common';
import { DOCUMENT } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';

interface DashboardPreferences {
  theme: ThemePreference;
  motionEnabled: boolean;
  spendVisible: boolean;
  sidebarCollapsed: boolean;
}

const STORAGE_KEY = 'fardelins.dashboard.preferences.v2';
const DEFAULTS: DashboardPreferences = {
  theme: 'dark',
  motionEnabled: true,
  spendVisible: true,
  sidebarCollapsed: false,
};

@Injectable({ providedIn: 'root' })
export class DashboardPreferencesService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly systemDark = signal(false);
  private readonly preferences = signal<DashboardPreferences>(this.read());

  readonly theme = computed(() => this.preferences().theme);
  readonly motionEnabled = computed(() => this.preferences().motionEnabled);
  readonly spendVisible = computed(() => this.preferences().spendVisible);
  readonly sidebarCollapsed = computed(() => this.preferences().sidebarCollapsed);
  readonly effectiveTheme = computed<'light' | 'dark'>(() => {
    const theme = this.theme();
    return theme === 'system' ? (this.systemDark() ? 'dark' : 'light') : theme;
  });

  constructor() {
    if (this.isBrowser) {
      const query = matchMedia('(prefers-color-scheme: dark)');
      this.systemDark.set(query.matches);
      query.addEventListener('change', (event) => this.systemDark.set(event.matches));
    }
    effect(() => {
      const root = this.document.documentElement;
      // setAttribute, not dataset: Angular's server DOM (domino) has no dataset at all.
      root.setAttribute('data-theme', this.effectiveTheme());
      root.classList.toggle('dashboard-motion-off', !this.motionEnabled());
    });
  }

  setTheme(theme: ThemePreference): void {
    this.update({ theme });
  }

  setMotionEnabled(motionEnabled: boolean): void {
    this.update({ motionEnabled });
  }

  setSpendVisible(spendVisible: boolean): void {
    this.update({ spendVisible });
  }

  toggleSidebar(): void {
    this.update({ sidebarCollapsed: !this.preferences().sidebarCollapsed });
  }

  private update(change: Partial<DashboardPreferences>): void {
    this.preferences.update((current) => ({ ...current, ...change }));
    if (this.isBrowser) localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences()));
  }

  private read(): DashboardPreferences {
    if (!this.isBrowser) return DEFAULTS;
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? '{}',
      ) as Partial<DashboardPreferences>;
      return { ...DEFAULTS, ...saved };
    } catch {
      return DEFAULTS;
    }
  }
}
