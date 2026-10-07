import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { solarRefreshBoldDuotone } from '@ng-icons/solar-icons/bold-duotone';
import { HapticsService } from '@core/services/haptics.service';
import { SITE_URL_TOKEN } from '@core/services/seo.service';
import { TiltDirective } from '@shared/directives/tilt.directive';
import { QrSpotlightDirective } from '@shared/directives/qr-spotlight.directive';
import { QrFinderPattern, QrModule, buildQrGlyphs } from '@shared/utils/qr-glyphs';

const CODE_LIFETIME_SECONDS = 120;
const QUIET_ZONE_MODULES = 2;
const FINDER_SIZE_MODULES = 7;
const LOGO_SIZE_MODULES = 7;
/** Skeleton beat before the reveal, so the code doesn't just pop in. */
const SKELETON_MS = 620;
const REVEAL_MS = 380;
const REVEAL_STAGGER_MS = 860;

@Component({
  selector: 'app-qr-signin',
  imports: [NgIcon, TiltDirective, QrSpotlightDirective],
  viewProviders: [provideIcons({ solarRefreshBoldDuotone })],
  templateUrl: './qr-signin.html',
  styleUrl: './qr-signin.css',
})
export class QrSignin implements OnDestroy {
  private readonly haptics = inject(HapticsService);
  private readonly siteUrl = inject(SITE_URL_TOKEN);

  protected readonly modules = signal<QrModule[]>([]);
  protected readonly finders = signal<QrFinderPattern[]>([]);
  protected readonly size = signal(0);
  protected readonly revealing = signal(false);
  protected readonly secondsLeft = signal(CODE_LIFETIME_SECONDS);
  protected readonly expired = computed(() => this.secondsLeft() <= 0);
  protected readonly loading = computed(() => this.modules().length === 0);
  protected readonly countdown = computed(() => {
    const total = Math.max(0, this.secondsLeft());
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  });
  protected readonly span = computed(() => this.size() + QUIET_ZONE_MODULES * 2);
  protected readonly viewBox = computed(() =>
    this.span() > 0 ? `0 0 ${this.span()} ${this.span()}` : '0 0 1 1',
  );
  protected readonly revealMs = REVEAL_MS;
  protected readonly revealStaggerMs = REVEAL_STAGGER_MS;

  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    void this.issueCode();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  protected refresh(): void {
    this.haptics.selection();
    void this.issueCode();
  }

  private async issueCode(): Promise<void> {
    this.stopTimer();
    this.modules.set([]);
    this.revealing.set(false);
    this.secondsLeft.set(CODE_LIFETIME_SECONDS);

    const [glyphs] = await Promise.all([
      buildQrGlyphs(this.nextPayload(), {
        quietZoneModules: QUIET_ZONE_MODULES,
        finderSizeModules: FINDER_SIZE_MODULES,
        logoSizeModules: LOGO_SIZE_MODULES,
        errorCorrection: 'H',
      }),
      new Promise((resolve) => setTimeout(resolve, SKELETON_MS)),
    ]);

    this.size.set(glyphs.size);
    this.modules.set(glyphs.modules);
    this.finders.set(glyphs.finders);
    // Keep the class mounted so a delayed browser frame cannot cancel the reveal before it paints.
    this.revealing.set(true);

    this.timer = setInterval(() => {
      const next = this.secondsLeft() - 1;
      this.secondsLeft.set(next);
      if (next <= 0) this.stopTimer();
    }, 1000);
  }

  // A real, working URL: scanning this opens the app download page. Only the trailing
  // id is stand-in, so the code visibly changes on refresh.
  private nextPayload(): string {
    const nonce = Math.random().toString(36).slice(2, 10);
    return `${this.siteUrl}/download?ref=qr-signin&s=${nonce}`;
  }

  private stopTimer(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}
