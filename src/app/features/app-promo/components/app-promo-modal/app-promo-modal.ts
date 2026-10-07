import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarCloseCircleBoldDuotone,
  solarScannerBoldDuotone,
  solarSmartphoneBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { APP_DOWNLOAD_CONFIG } from '@core/config/app-download.config';
import { AuthService } from '@core/auth/auth.service';
import { AppPlatformService } from '@core/services/app-platform.service';
import { HapticsService } from '@core/services/haptics.service';
import { SITE_URL_TOKEN } from '@core/services/seo.service';
import { TiltDirective } from '@shared/directives/tilt.directive';
import { QrSpotlightDirective } from '@shared/directives/qr-spotlight.directive';
import { QrFinderPattern, QrModule, buildQrGlyphs } from '@shared/utils/qr-glyphs';
import { appPromoCopy, AppPromoTrigger } from '../../app-promo.model';
import { AppPromoOutcome, AppPromoService } from '../../app-promo.service';

const QUIET_ZONE_MODULES = 2;
const FINDER_SIZE_MODULES = 7;
const LOGO_SIZE_MODULES = 7;
/** Same beat as the QR sign-in plate, so the two read as one system. */
const REVEAL_MS = 380;
const REVEAL_STAGGER_MS = 860;
const CTA_LABEL = 'Download App';

@Component({
  selector: 'app-promo-modal',
  imports: [NgIcon, RouterLink, TiltDirective, QrSpotlightDirective],
  viewProviders: [
    provideIcons({
      solarCloseCircleBoldDuotone,
      solarScannerBoldDuotone,
      solarSmartphoneBoldDuotone,
    }),
  ],
  templateUrl: './app-promo-modal.html',
  styleUrls: ['../../../../shared/styles/forms.css', './app-promo-modal.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppPromoModal {
  private readonly appPlatform = inject(AppPlatformService);
  private readonly haptics = inject(HapticsService);
  private readonly auth = inject(AuthService);
  private readonly promo = inject(AppPromoService);
  private readonly siteUrl = inject(SITE_URL_TOKEN);
  private readonly destroyRef = inject(DestroyRef);

  readonly trigger = input.required<AppPromoTrigger>();
  readonly closed = output<AppPromoOutcome>();

  private readonly dialog = viewChild.required<ElementRef<HTMLElement>>('dialog');

  protected readonly copy = computed(() =>
    appPromoCopy(this.trigger(), this.auth.user()?.firstName ?? null),
  );
  // Phone first: it's the face that actually sells the app, on every device.
  protected readonly face = signal<'phone' | 'qr'>('phone');
  protected readonly qrModules = signal<QrModule[]>([]);
  protected readonly qrFinders = signal<QrFinderPattern[]>([]);
  protected readonly qrSpan = signal(0);
  protected readonly qrRevealing = signal(false);
  protected readonly qrViewBox = computed(() => `0 0 ${this.qrSpan()} ${this.qrSpan()}`);
  protected readonly qrRevealMs = REVEAL_MS;
  protected readonly qrRevealStaggerMs = REVEAL_STAGGER_MS;

  protected readonly ctaLabel = CTA_LABEL;
  /** Empty until the store URLs are filled in, which is when the CTA leaves the site. */
  protected readonly storeUrl = this.appPlatform.preferredStore?.url ?? '';
  protected readonly downloadRoute = APP_DOWNLOAD_CONFIG.route;
  protected readonly sendLinkEnabled = APP_DOWNLOAD_CONFIG.sendLink.enabled;
  protected readonly phone = computed(() => this.auth.user()?.phone ?? '');
  protected readonly linkSent = this.promo.linkSent;
  protected readonly sendingLink = signal(false);
  protected readonly sendError = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.face() === 'qr' && !this.qrModules().length) void this.buildQr();
    });

    afterNextRender(() => {
      this.dialog().nativeElement.focus();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      this.destroyRef.onDestroy(() => {
        document.body.style.overflow = previousOverflow;
      });
    });
  }

  protected flip(): void {
    this.haptics.selection();
    this.face.update((current) => (current === 'phone' ? 'qr' : 'phone'));
  }

  protected accept(): void {
    this.haptics.light();
    this.closed.emit('accept');
  }

  protected notNow(): void {
    this.haptics.selection();
    this.closed.emit('not-now');
  }

  protected dismiss(): void {
    this.closed.emit('dismiss');
  }

  protected backdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.dismiss();
  }

  protected async sendLink(): Promise<void> {
    const phone = this.phone();
    if (!phone || this.sendingLink() || this.linkSent()) return;
    this.sendingLink.set(true);
    this.sendError.set(null);
    try {
      await this.promo.sendLink(phone);
      this.haptics.success();
    } catch {
      this.sendError.set("That didn't send. Try the QR code instead.");
      this.haptics.error();
    } finally {
      this.sendingLink.set(false);
    }
  }

  private async buildQr(): Promise<void> {
    const glyphs = await buildQrGlyphs(
      `${this.siteUrl}${APP_DOWNLOAD_CONFIG.route}?ref=promo-${this.trigger()}`,
      {
        quietZoneModules: QUIET_ZONE_MODULES,
        finderSizeModules: FINDER_SIZE_MODULES,
        logoSizeModules: LOGO_SIZE_MODULES,
        errorCorrection: 'H',
      },
    );
    this.qrSpan.set(glyphs.span);
    this.qrModules.set(glyphs.modules);
    this.qrFinders.set(glyphs.finders);
    this.qrRevealing.set(true);
  }
}
