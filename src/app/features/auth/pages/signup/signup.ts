import { Component, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js';
import {
  solarDangerCircleBoldDuotone,
  solarEyeBoldDuotone,
  solarEyeClosedBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { AuthService } from '@core/auth/auth.service';
import { GoogleIdentityService } from '@core/auth/google-identity.service';
import { HapticsService } from '@core/services/haptics.service';
import { SITE_NAME, SeoService } from '@core/services/seo.service';
import { COUNTRIES, PhoneInput } from '@shared/components/phone-input/phone-input';
import { AuthShell } from '../../components/auth-shell/auth-shell';
import { AUTH_SOCIAL_PROOF } from '../../social-proof';

interface PasswordCheck {
  label: string;
  test: (value: string) => boolean;
}

// Backend rejects with "password is not strong enough" but never says what strong means,
// this is our best-guess rule set, shown live so the 400 doesn't come as a surprise.
const PASSWORD_CHECKS: PasswordCheck[] = [
  { label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter', test: (v) => /[a-z]/.test(v) },
  { label: 'One number', test: (v) => /\d/.test(v) },
  { label: 'One symbol', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

@Component({
  selector: 'app-signup',
  imports: [RouterLink, NgIcon, AuthShell, PhoneInput],
  viewProviders: [
    provideIcons({ solarEyeBoldDuotone, solarEyeClosedBoldDuotone, solarDangerCircleBoldDuotone }),
  ],
  templateUrl: './signup.html',
  styleUrls: ['../../../../shared/styles/forms.css', './signup.css'],
})
export class Signup {
  private readonly auth = inject(AuthService);
  private readonly googleIdentity = inject(GoogleIdentityService);
  private readonly router = inject(Router);
  private readonly haptics = inject(HapticsService);
  private readonly seo = inject(SeoService);

  protected readonly panelProof = AUTH_SOCIAL_PROOF;

  protected readonly submitting = signal(false);
  protected readonly googleSubmitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly emailTaken = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly country = signal<CountryCode>('NG');
  protected readonly phone = signal('');

  protected readonly password = signal('');
  protected readonly passwordTouched = signal(false);

  private readonly passwordChecks = computed(() =>
    PASSWORD_CHECKS.map((check) => check.test(this.password())),
  );
  protected readonly passwordValid = computed(() => this.passwordChecks().every(Boolean));

  // 5 rules collapse to a 4-bar meter, with the first rule met not yet worth a bar,
  // met 0/1/2/3/4/5 -> 0/0/1/2/3/4 bars.
  protected readonly strengthLevel = computed(() => {
    const met = this.passwordChecks().filter(Boolean).length;
    return Math.max(0, met - 1);
  });
  protected readonly strengthTier = computed<'weak' | 'fair' | 'good' | 'strong'>(() => {
    const level = this.strengthLevel();
    if (level <= 1) return 'weak';
    if (level === 2) return 'fair';
    if (level === 3) return 'good';
    return 'strong';
  });

  private readonly googleButtonSlot = viewChild<ElementRef<HTMLElement>>('googleButtonSlot');

  constructor() {
    this.seo.update({
      title: `Create an account | ${SITE_NAME}`,
      description: 'Create a Fardelins account to start sending packages.',
      path: '/signup',
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

  private async handleGoogleCredential(idToken: string): Promise<void> {
    if (this.submitting() || this.googleSubmitting()) return;
    this.error.set(null);
    this.googleSubmitting.set(true);

    try {
      // Unlike password signup, Google already vouches for the email, no verify step.
      await this.auth.loginWithGoogle(idToken);
      this.haptics.success();
      // Google never hands over a phone number, unlike this page's own form, fill that gap.
      if (this.auth.user()?.phone) {
        await this.router.navigateByUrl('/app');
      } else {
        await this.router.navigateByUrl('/signup/phone');
      }
    } catch (error) {
      this.error.set((error as Error).message);
      this.haptics.error();
    } finally {
      this.googleSubmitting.set(false);
    }
  }

  protected async checkEmail(email: string): Promise<void> {
    this.emailTaken.set(false);
    if (!email.includes('@')) return;
    this.emailTaken.set(!(await this.auth.emailAvailable(email)));
  }

  protected async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.submitting()) return;

    const form = event.currentTarget as HTMLFormElement;
    this.passwordTouched.set(true);

    const values = new FormData(form);
    // Autofill sets the value without firing `input`, so the signal can lag the real field.
    this.password.set(String(values.get('password') ?? ''));

    if (!form.reportValidity()) {
      this.haptics.error();
      return;
    }

    // Native validation can't express the strength rules; the meter below the field
    // carries the message, so this just returns focus to where the fix has to happen.
    if (!this.passwordValid()) {
      this.haptics.error();
      form.querySelector<HTMLInputElement>('input[name="password"]')?.focus();
      return;
    }

    const email = String(values.get('email') ?? '');
    const phoneNumber = parsePhoneNumberFromString(this.phone(), this.country());
    if (!phoneNumber?.isValid()) {
      this.error.set('Enter a valid mobile number.');
      this.haptics.error();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.haptics.light();

    const selectedCountry = COUNTRIES.find((item) => item.iso2 === this.country()) ?? COUNTRIES[0];

    try {
      await this.auth.register(
        {
          first_name: String(values.get('firstName') ?? '').trim(),
          last_name: String(values.get('lastName') ?? '').trim(),
          email: email.trim(),
          password: this.password(),
          phone: phoneNumber.number,
        },
        {
          iso2: selectedCountry.iso2,
          name: selectedCountry.name,
        },
      );
      this.haptics.success();
      await this.router.navigate(['/signup/verify'], { queryParams: { email: email.trim() } });
    } catch (error) {
      this.error.set((error as Error).message);
      this.haptics.error();
    } finally {
      this.submitting.set(false);
    }
  }
}
