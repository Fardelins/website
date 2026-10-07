import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarDangerCircleBoldDuotone,
  solarEyeBoldDuotone,
  solarEyeClosedBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { AuthService } from '@core/auth/auth.service';
import { parseApiError } from '@core/auth/auth.models';
import { PasswordResetService } from '@core/auth/password-reset.service';
import { HapticsService } from '@core/services/haptics.service';
import { SITE_NAME, SeoService } from '@core/services/seo.service';
import { AuthShell } from '../../components/auth-shell/auth-shell';

@Component({
  selector: 'app-reset-password',
  imports: [RouterLink, NgIcon, AuthShell],
  viewProviders: [
    provideIcons({ solarEyeBoldDuotone, solarEyeClosedBoldDuotone, solarDangerCircleBoldDuotone }),
  ],
  templateUrl: './reset-password.html',
  styleUrls: ['../../../../shared/styles/forms.css', './reset-password.css'],
})
export class ResetPassword {
  private readonly auth = inject(AuthService);
  private readonly passwordReset = inject(PasswordResetService);
  private readonly router = inject(Router);
  private readonly haptics = inject(HapticsService);
  private readonly seo = inject(SeoService);

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly resetToken = this.passwordReset.resetToken;

  constructor() {
    this.seo.update({
      title: `Set a new password | ${SITE_NAME}`,
      description: 'Choose a new password for your Fardelins account.',
      path: '/reset-password',
      robots: 'noindex, nofollow',
    });
  }

  protected async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.submitting()) return;

    const resetToken = this.resetToken();
    if (!resetToken) return;

    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;

    const values = new FormData(form);
    const password = String(values.get('password') ?? '');
    if (password !== String(values.get('confirmPassword') ?? '')) {
      this.error.set('Those passwords do not match.');
      this.haptics.error();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.haptics.light();

    try {
      await this.auth.changePassword(resetToken, password);
      this.passwordReset.clear();
      this.haptics.success();
      await this.router.navigate(['/login'], { queryParams: { reset: 1 } });
    } catch (error) {
      this.error.set(parseApiError(error, 'That reset session has expired. Request a new code.'));
      this.haptics.error();
    } finally {
      this.submitting.set(false);
    }
  }

  protected setPasswordValidity(el: HTMLInputElement): void {
    if (!el.validity.tooShort) return;
    el.setCustomValidity(`Use at least ${el.minLength} characters.`);
  }

  protected checkPasswordsMatch(password: HTMLInputElement, confirm: HTMLInputElement): void {
    if (!confirm.value || confirm.value === password.value) return;
    confirm.setCustomValidity('Those passwords do not match.');
    confirm.reportValidity();
  }
}
