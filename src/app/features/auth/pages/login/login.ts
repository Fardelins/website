import { Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarDangerCircleBoldDuotone,
  solarEyeBoldDuotone,
  solarEyeClosedBoldDuotone,
  solarQRCodeBoldDuotone,
  solarKeyBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { AuthService } from '@core/auth/auth.service';
import { GoogleIdentityService } from '@core/auth/google-identity.service';
import { HapticsService } from '@core/services/haptics.service';
import { SITE_NAME, SeoService } from '@core/services/seo.service';
import { AuthShell } from '../../components/auth-shell/auth-shell';
import { AUTH_SOCIAL_PROOF } from '../../social-proof';
import { QrSignin } from '../../components/qr-signin/qr-signin';

@Component({
  selector: 'app-login',
  imports: [RouterLink, NgIcon, AuthShell, QrSignin],
  viewProviders: [
    provideIcons({
      solarEyeBoldDuotone,
      solarEyeClosedBoldDuotone,
      solarDangerCircleBoldDuotone,
      solarQRCodeBoldDuotone,
      solarKeyBoldDuotone,
    }),
  ],
  templateUrl: './login.html',
  styleUrls: ['../../../../shared/styles/forms.css', './login.css'],
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly googleIdentity = inject(GoogleIdentityService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly haptics = inject(HapticsService);
  private readonly seo = inject(SeoService);

  protected readonly submitting = signal(false);
  protected readonly googleSubmitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = this.auth.takeSignedOutNotice();
  protected readonly showPassword = signal(false);
  protected readonly panelProof = AUTH_SOCIAL_PROOF;

  protected readonly mode = signal<'password' | 'qr'>('password');

  private readonly pane = viewChild<ElementRef<HTMLElement>>('pane');
  // Lives inside the password-mode branch, so it unmounts/remounts with the QR toggle,
  // the effect re-renders Google's button each time it comes back, not just once.
  private readonly googleButtonSlot = viewChild<ElementRef<HTMLElement>>('googleButtonSlot');

  private async handleGoogleCredential(idToken: string): Promise<void> {
    if (this.submitting() || this.googleSubmitting()) return;
    this.error.set(null);
    this.googleSubmitting.set(true);

    try {
      await this.auth.loginWithGoogle(idToken);
      this.haptics.success();
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      const target = returnUrl && returnUrl.startsWith('/app') ? returnUrl : '/app';
      // Google never hands over a phone number, send first-timers to fill that gap.
      if (this.auth.user()?.phone) {
        await this.router.navigateByUrl(target);
      } else {
        await this.router.navigate(['/signup/phone'], { queryParams: { returnUrl: target } });
      }
    } catch (error) {
      this.error.set((error as Error).message);
      this.haptics.error();
    } finally {
      this.googleSubmitting.set(false);
    }
  }

  protected async setMode(mode: 'password' | 'qr'): Promise<void> {
    this.haptics.light();
    const element = this.pane()?.nativeElement;
    if (!element || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.mode.set(mode);
      return;
    }

    const { animate } = await import('motion/mini');
    await animate(element, { opacity: 0, transform: 'translateY(8px)' }, { duration: 0.14 });
    this.mode.set(mode);
    requestAnimationFrame(() => {
      void animate(
        element,
        { opacity: 1, transform: 'translateY(0px)' },
        { type: 'spring', stiffness: 320, damping: 30, mass: 0.8 },
      );
    });
  }

  constructor() {
    this.seo.update({
      title: `Log in | ${SITE_NAME}`,
      description: 'Log in to your Fardelins account.',
      path: '/login',
      robots: 'noindex, nofollow',
    });

    effect(() => {
      const container = this.googleButtonSlot()?.nativeElement;
      if (!container) return;
      void this.googleIdentity.renderButton(container, (idToken) =>
        this.handleGoogleCredential(idToken),
      );
    });
  }

  protected async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.submitting()) return;

    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;

    const values = new FormData(form);
    this.submitting.set(true);
    this.error.set(null);
    this.haptics.light();

    try {
      await this.auth.login(
        String(values.get('email') ?? ''),
        String(values.get('password') ?? ''),
      );
      this.haptics.success();
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      await this.router.navigateByUrl(
        returnUrl && returnUrl.startsWith('/app') ? returnUrl : '/app',
      );
    } catch (error) {
      this.error.set((error as Error).message);
      this.haptics.error();
    } finally {
      this.submitting.set(false);
    }
  }
}
