import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarDangerCircleBoldDuotone,
  solarLetterUnreadBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { AuthService } from '@core/auth/auth.service';
import { HapticsService } from '@core/services/haptics.service';
import { SITE_NAME, SeoService } from '@core/services/seo.service';
import { parseApiError } from '@core/auth/auth.models';
import { AuthShell } from '../../components/auth-shell/auth-shell';

const RESEND_COOLDOWN_S = 45;

// Signup verification is a link in the email, not a code, clicking it hits the API's own
// /auth/verify/{token} directly, which redirects back to /email-verified when it's done.
// This page is just the "go check your inbox" waiting room in between.
@Component({
  selector: 'app-verify-email',
  imports: [NgIcon, AuthShell, RouterLink],
  viewProviders: [provideIcons({ solarDangerCircleBoldDuotone, solarLetterUnreadBoldDuotone })],
  templateUrl: './verify-email.html',
  styleUrls: ['../../../../shared/styles/forms.css', './verify-email.css'],
})
export class VerifyEmail {
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly haptics = inject(HapticsService);
  private readonly seo = inject(SeoService);
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  protected readonly resending = signal(false);
  protected readonly cooldown = signal(0);
  protected readonly error = signal<string | null>(null);
  protected readonly email = signal('');

  constructor() {
    this.email.set(this.route.snapshot.queryParamMap.get('email') ?? '');
    this.seo.update({
      title: `Verify your email | ${SITE_NAME}`,
      description: 'Confirm your email address to finish setting up your Fardelins account.',
      path: '/signup/verify',
      robots: 'noindex, nofollow',
    });
    this.startCooldown();
    inject(DestroyRef).onDestroy(() => this.stopCooldown());
  }

  protected get maskedEmail(): string {
    const [name, domain] = this.email().split('@');
    if (!domain) return this.email();
    const head = name.slice(0, 2);
    return `${head}${'•'.repeat(Math.max(name.length - 2, 1))}@${domain}`;
  }

  protected async resend(): Promise<void> {
    if (this.cooldown() > 0 || this.resending()) return;
    this.resending.set(true);
    this.error.set(null);
    try {
      await this.auth.resendVerificationEmail(this.email());
      this.haptics.success();
      this.startCooldown();
    } catch (error) {
      this.error.set(parseApiError(error, "We couldn't resend that email. Try again shortly."));
      this.haptics.error();
    } finally {
      this.resending.set(false);
    }
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
