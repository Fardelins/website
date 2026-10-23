import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarLockKeyholeBoldDuotone,
  solarShareBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { AuthService } from '@core/auth/auth.service';
import { HapticsService } from '@core/services/haptics.service';
import { SITE_URL_TOKEN } from '@core/services/seo.service';
import { ToastService } from '@core/services/toast.service';
import { QrGlyphs, buildQrGlyphs } from '@shared/utils/qr-glyphs';
import { USERNAME_PATTERN } from '../../pages/scanned-profile/public-profile.service';
import { ProfileService } from '../../profile.service';
import { CardImageService } from '../profile-qr-card/card-image.service';
import { ProfileQrCard } from '../profile-qr-card/profile-qr-card';
import {
  DEFAULT_QR_CARD_THEME,
  QR_CARD_THEMES,
  QrCardThemeId,
  qrCardTheme,
} from '../profile-qr-card/qr-card-themes';

const QUIET_ZONE_MODULES = 2;
const FINDER_SIZE_MODULES = 7;
const LOGO_SIZE_MODULES = 7;
const THEME_KEY = 'fardelins.qr-card-theme';
/** Draws the picture ahead of the tap, so the share sheet opens while the tap still counts as a gesture. */
const WARM_UP_MS = 350;

/** The signed-in person's QR card: pick a colour, then share it as a picture with the link. */
@Component({
  selector: 'app-my-qr',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgIcon, ProfileQrCard],
  viewProviders: [provideIcons({ solarShareBoldDuotone, solarLockKeyholeBoldDuotone })],
  styleUrls: ['../../../../shared/styles/forms.css', './my-qr.css'],
  templateUrl: './my-qr.html',
})
export class MyQr {
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private readonly siteUrl = inject(SITE_URL_TOKEN);
  private readonly toast = inject(ToastService);
  private readonly haptics = inject(HapticsService);
  private readonly cardImages = inject(CardImageService);

  protected readonly user = this.auth.user;
  protected readonly username = computed(() => this.user()?.username ?? null);
  protected readonly fullName = computed(() => {
    const user = this.user();
    return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Fardelins customer';
  });
  protected readonly initials = computed(() => {
    const user = this.user();
    return ((user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '')).toUpperCase() || 'F';
  });
  protected readonly link = computed(() => {
    const username = this.username();
    return username ? `${this.siteUrl}/u/${username}` : null;
  });
  protected readonly displayLink = computed(() => this.link()?.replace(/^https?:\/\//, '') ?? '');

  protected readonly glyphs = signal<QrGlyphs | null>(null);
  protected readonly themes = QR_CARD_THEMES;
  protected readonly themeId = signal<QrCardThemeId>(this.savedTheme());
  protected readonly theme = computed(() => qrCardTheme(this.themeId()));
  protected readonly sharing = signal(false);

  protected readonly choice = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly choiceValid = computed(() => USERNAME_PATTERN.test(this.choice()));

  private codeRequest = 0;
  private cardImage: { key: string; blob: Promise<Blob> } | null = null;
  private warmTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    effect(() => {
      const link = this.link();
      const request = ++this.codeRequest;
      if (!link) {
        this.glyphs.set(null);
        return;
      }
      void buildQrGlyphs(link, {
        quietZoneModules: QUIET_ZONE_MODULES,
        finderSizeModules: FINDER_SIZE_MODULES,
        logoSizeModules: LOGO_SIZE_MODULES,
        errorCorrection: 'H',
      }).then((glyphs) => {
        if (request === this.codeRequest) this.glyphs.set(glyphs);
      });
    });

    effect(() => {
      this.imageKey();
      clearTimeout(this.warmTimer);
      this.warmTimer = setTimeout(() => void this.cardPicture().catch(() => undefined), WARM_UP_MS);
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.warmTimer));
  }

  protected pickTheme(id: QrCardThemeId): void {
    if (id === this.themeId()) return;
    this.haptics.selection();
    this.themeId.set(id);
    try {
      localStorage.setItem(THEME_KEY, id);
    } catch {
      // Private mode: the choice just isn't remembered.
    }
  }

  protected onSwatchKey(event: KeyboardEvent): void {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const index = QR_CARD_THEMES.findIndex((theme) => theme.id === this.themeId());
    const next = QR_CARD_THEMES[(index + step + QR_CARD_THEMES.length) % QR_CARD_THEMES.length];
    this.pickTheme(next.id);
    const buttons = (event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>(
      '[role="radio"]',
    );
    buttons[QR_CARD_THEMES.indexOf(next)]?.focus();
  }

  protected async share(): Promise<void> {
    const link = this.link();
    const handle = this.username();
    if (!link || !handle || !this.glyphs() || this.sharing()) return;

    this.sharing.set(true);
    this.haptics.light();
    try {
      const blob = await this.cardPicture();
      const file = new File([blob], `fardelins-${handle}.png`, { type: 'image/png' });
      const title = `${this.fullName()} on Fardelins`;
      const text = `Find me on Fardelins: ${link}`;

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text });
      } else if (navigator.share) {
        await navigator.share({ title, text, url: link });
      } else {
        this.cardImages.save(blob, file.name);
        await navigator.clipboard?.writeText(link).catch(() => undefined);
        this.toast.success('Card saved and link copied', { description: file.name });
      }
      this.haptics.success();
    } catch (error) {
      // Closing the share sheet is not a failure.
      if ((error as Error)?.name === 'AbortError') return;
      this.toast.error("Couldn't share your card", {
        actions: [{ label: 'Try again', run: () => void this.share() }],
      });
      this.haptics.error();
    } finally {
      this.sharing.set(false);
    }
  }

  protected onChoice(value: string): void {
    this.choice.set(value.trim());
    this.error.set(null);
  }

  protected async saveUsername(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.choiceValid() || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      await this.profile.updateUsername(this.choice());
      this.haptics.success();
      this.toast.success('Username saved');
    } catch (error) {
      this.error.set((error as Error).message);
      this.haptics.error();
    } finally {
      this.saving.set(false);
    }
  }

  /** What the picture is made from; it is redrawn whenever any of it changes. */
  private imageKey(): string {
    const glyphs = this.glyphs();
    return [
      this.themeId(),
      this.fullName(),
      this.username(),
      this.user()?.avatarUrl ?? '',
      glyphs ? glyphs.size : 0,
    ].join('|');
  }

  private cardPicture(): Promise<Blob> {
    const glyphs = this.glyphs();
    const handle = this.username();
    if (!glyphs || !handle) return Promise.reject(new Error('The card is not ready yet.'));
    const key = this.imageKey();
    if (this.cardImage?.key === key) return this.cardImage.blob;

    const blob = this.cardImages.render({
      theme: this.theme(),
      name: this.fullName(),
      handle,
      initials: this.initials(),
      avatarUrl: this.user()?.avatarUrl ?? null,
      displayLink: this.displayLink(),
      glyphs,
    });
    this.cardImage = { key, blob };
    blob.catch(() => {
      if (this.cardImage?.blob === blob) this.cardImage = null;
    });
    return blob;
  }

  private savedTheme(): QrCardThemeId {
    try {
      return qrCardTheme(localStorage.getItem(THEME_KEY)).id;
    } catch {
      return DEFAULT_QR_CARD_THEME;
    }
  }
}
