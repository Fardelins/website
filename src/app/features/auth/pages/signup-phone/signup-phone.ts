import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { solarDangerCircleBoldDuotone } from '@ng-icons/solar-icons/bold-duotone';
import { CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js';
import { AuthService } from '@core/auth/auth.service';
import { HapticsService } from '@core/services/haptics.service';
import { SITE_NAME, SeoService } from '@core/services/seo.service';
import { PhoneInput } from '@shared/components/phone-input/phone-input';
import { ProfileService } from '@features/profile/profile.service';
import { AuthShell } from '../../components/auth-shell/auth-shell';

// Google never hands over a phone number, unlike the password signup form which
// requires one, this is the gap-fill step, gated by needsPhoneGuard.
@Component({
  selector: 'app-signup-phone',
  imports: [AuthShell, PhoneInput, NgIcon],
  viewProviders: [provideIcons({ solarDangerCircleBoldDuotone })],
  templateUrl: './signup-phone.html',
  styleUrls: ['../../../../shared/styles/forms.css', './signup-phone.css'],
})
export class SignupPhone {
  private readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly haptics = inject(HapticsService);
  private readonly seo = inject(SeoService);

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly displayName = this.auth.displayName;

  protected readonly country = signal<CountryCode>('NG');
  protected readonly phone = signal('');

  constructor() {
    this.seo.update({
      title: `Add your phone number | ${SITE_NAME}`,
      description: 'Add a phone number to finish setting up your Fardelins account.',
      path: '/signup/phone',
      robots: 'noindex, nofollow',
    });
  }

  protected async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.submitting()) return;

    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;

    const phoneNumber = parsePhoneNumberFromString(this.phone(), this.country());
    if (!phoneNumber?.isValid()) {
      this.error.set('Enter a valid mobile number.');
      this.haptics.error();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.haptics.light();

    try {
      await this.profile.update({ phone: phoneNumber.number });
      this.haptics.success();
      await this.router.navigateByUrl(this.returnUrl());
    } catch (error) {
      this.error.set((error as Error).message);
      this.haptics.error();
    } finally {
      this.submitting.set(false);
    }
  }

  private returnUrl(): string {
    const url = this.route.snapshot.queryParamMap.get('returnUrl');
    return url && url.startsWith('/app') ? url : '/app';
  }
}
