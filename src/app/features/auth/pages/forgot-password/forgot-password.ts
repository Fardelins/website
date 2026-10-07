import { Component, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { solarDangerCircleBoldDuotone } from '@ng-icons/solar-icons/bold-duotone';
import { AuthService } from '@core/auth/auth.service';
import { parseApiError } from '@core/auth/auth.models';
import { PasswordResetService } from '@core/auth/password-reset.service';
import { HapticsService } from '@core/services/haptics.service';
import { SITE_NAME, SeoService } from '@core/services/seo.service';
import { OtpInput, OtpStatus } from '@shared/components/otp-input/otp-input';
import { AuthShell } from '../../components/auth-shell/auth-shell';

const OTP_LENGTH = 4;
const RESEND_COOLDOWN_S = 45;
// Lets the success pop actually play before the route change tears the component down.
const SUCCESS_PAUSE_MS = 500;

@Component({
  selector: 'app-forgot-password',
  imports: [RouterLink, NgIcon, AuthShell, OtpInput],
  viewProviders: [provideIcons({ solarDangerCircleBoldDuotone })],
  templateUrl: './forgot-password.html',
  styleUrls: ['../../../../shared/styles/forms.css', './forgot-password.css'],
})
export class ForgotPassword {
  private readonly auth = inject(AuthService);
  private readonly passwordReset = inject(PasswordResetService);
  private readonly router = inject(Router);
  private readonly haptics = inject(HapticsService);
  private readonly seo = inject(SeoService);
  protected readonly otp = viewChild(OtpInput);

  protected readonly otpLength = OTP_LENGTH;
  protected readonly stage = signal<'email' | 'otp'>('email');
  protected readonly submitting = signal(false);
  protected readonly otpStatus = signal<OtpStatus>('idle');
  protected readonly resending = signal(false);
  protected readonly cooldown = signal(0);
  protected readonly error = signal<string | null>(null);
  protected readonly email = signal('');
  private resetToken = '';
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.seo.update({
      title: `Reset your password | ${SITE_NAME}`,
      description: 'Request a password reset code for your Fardelins account.',
      path: '/forgot-password',
      robots: 'noindex, nofollow',
    });
    inject(DestroyRef).onDestroy(() => this.stopCooldown());
  }

  protected async requestOtp(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.submitting()) return;

    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;

    const email = String(new FormData(form).get('email') ?? '').trim();
    this.submitting.set(true);
    this.error.set(null);
    this.haptics.light();

    try {
      this.resetToken = await this.auth.requestPasswordResetOtp(email);
      this.email.set(email);
      this.stage.set('otp');
      this.startCooldown();
      this.haptics.success();
    } catch (error) {
      this.error.set(this.sendFailureMessage(error));
      this.haptics.error();
    } finally {
      this.submitting.set(false);
    }
  }

  /** The API's bare "Account not found." reads as a dead end, soften it into a next step. */
  private sendFailureMessage(error: unknown): string {
    const message = parseApiError(error, "We couldn't send that code. Please try again.");
    return /not\s*found/i.test(message)
      ? "Sorry, we can't find that account. Try another email address."
      : message;
  }

  protected async verifyOtp(code: string): Promise<void> {
    if (this.otpStatus() === 'checking') return;
    this.otpStatus.set('checking');
    this.error.set(null);

    try {
      await this.auth.validateResetOtp(this.resetToken, code);
      this.otpStatus.set('success');
      this.passwordReset.set(this.resetToken);
      await new Promise((resolve) => setTimeout(resolve, SUCCESS_PAUSE_MS));
      await this.router.navigate(['/reset-password']);
    } catch (error) {
      this.error.set(parseApiError(error, 'That code is not right. Check it and try again.'));
      this.otpStatus.set('error');
    }
  }

  protected async resend(): Promise<void> {
    if (this.cooldown() > 0 || this.resending()) return;
    this.resending.set(true);
    this.error.set(null);
    try {
      this.resetToken = await this.auth.requestPasswordResetOtp(this.email());
      this.otpStatus.set('idle');
      this.otp()?.reset();
      this.haptics.success();
      this.startCooldown();
    } catch (error) {
      this.error.set(parseApiError(error, "We couldn't resend that code. Try again shortly."));
      this.haptics.error();
    } finally {
      this.resending.set(false);
    }
  }

  protected useAnotherAddress(): void {
    this.stage.set('email');
    this.otpStatus.set('idle');
    this.error.set(null);
    this.stopCooldown();
  }

  private startCooldown(): void {
    this.cooldown.set(RESEND_COOLDOWN_S);
    this.stopCooldown();
    this.cooldownTimer = setInterval(() => {
      this.cooldown.update((value) => value - 1);
      if (this.cooldown() <= 0) this.stopCooldown();
    }, 1000);
  }

  private stopCooldown(): void {
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
    this.cooldownTimer = null;
  }
}
