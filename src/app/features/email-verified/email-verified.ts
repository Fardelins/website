import { Component, PLATFORM_ID, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { map } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCircleCheck, lucideCircleAlert } from '@ng-icons/lucide';
import { SITE_NAME, SeoService } from '@core/services/seo.service';
import { HapticsService } from '@core/services/haptics.service';

interface FallingConfettiPiece {
  readonly color: string;
  readonly left: number;
  readonly delay: number;
  readonly duration: number;
  readonly drift: number;
  readonly rotation: number;
}

interface BurstConfettiPiece {
  readonly color: string;
  readonly dx: number;
  readonly dy: number;
  readonly rotation: number;
}

type Variant = 'success' | 'already-verified' | 'error';

const CONFETTI_COLORS = ['#521c99', '#9776c1', '#29cc6a', '#0099ff'];
const FALLING_CONFETTI_COUNT = 60;
const BURST_CONFETTI_COUNT = 16;
// Kept short on purpose — the falling confetti is the main event, the icon burst is a quick coda after it lands.
const FALL_MAX_DELAY_MS = 300;
const FALL_MAX_DURATION_MS = 1900;

@Component({
  selector: 'app-email-verified',
  imports: [RouterLink, NgIcon],
  viewProviders: [provideIcons({ lucideCircleCheck, lucideCircleAlert })],
  templateUrl: './email-verified.html',
  styleUrl: './email-verified.css',
})
export class EmailVerified {
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);
  private readonly haptics = inject(HapticsService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly query = toSignal(
    this.route.queryParamMap.pipe(
      map((params) => ({
        status: params.get('status'),
        message: params.get('message'),
      })),
    ),
    {
      initialValue: {
        status: this.route.snapshot.queryParamMap.get('status'),
        message: this.route.snapshot.queryParamMap.get('message'),
      },
    },
  );

  protected readonly isSuccess = computed(() => this.query().status === 'success');

  // "Already verified" isn't really a failure — it gets its own copy and a lighter haptic than a broken link.
  protected readonly variant = computed<Variant>(() => {
    if (this.isSuccess()) return 'success';
    return (this.query().message ?? '').toLowerCase().includes('already verified')
      ? 'already-verified'
      : 'error';
  });

  protected readonly headline = computed(() => {
    switch (this.variant()) {
      case 'success':
        return 'Email verified';
      case 'already-verified':
        return 'Already verified';
      default:
        return 'Verification failed';
    }
  });

  protected readonly description = computed(() => {
    if (this.isSuccess()) {
      return 'Your email address has been verified successfully. You can now sign in to your account.';
    }
    return this.query().message || 'This verification link is invalid or has expired.';
  });

  // Fixed per load, not reactive — both confetti effects only ever play once, on the success state.
  protected readonly fallingConfetti: FallingConfettiPiece[] = this.buildFallingConfetti();
  protected readonly burstConfetti: BurstConfettiPiece[] = this.buildBurstConfetti();

  // The icon's burst waits for the falling confetti to finish landing.
  protected readonly burstDelayMs = FALL_MAX_DELAY_MS + FALL_MAX_DURATION_MS;

  constructor() {
    const success = this.route.snapshot.queryParamMap.get('status') === 'success';
    this.seo.update({
      title: `${success ? 'Email Verified' : 'Verification Failed'} | ${SITE_NAME}`,
      description: success
        ? 'Your email address has been verified successfully.'
        : 'Email verification failed. The link may be invalid or expired.',
      path: '/email-verified',
      robots: 'noindex, follow',
    });

    // Fires immediately, alongside the falling confetti — not held back for the icon burst.
    switch (this.variant()) {
      case 'success':
        this.haptics.success();
        break;
      case 'already-verified':
        this.haptics.selection();
        break;
      case 'error':
        this.haptics.error();
        break;
    }
  }

  private buildFallingConfetti(): FallingConfettiPiece[] {
    if (!this.isBrowser || !this.isSuccess()) return [];
    return Array.from({ length: FALLING_CONFETTI_COUNT }, (_, i) => ({
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      left: Math.random() * 100,
      delay: Math.random() * FALL_MAX_DELAY_MS,
      duration: FALL_MAX_DURATION_MS - Math.random() * 400,
      drift: Math.random() * 120 - 60,
      rotation: Math.random() * 720 - 360,
    }));
  }

  private buildBurstConfetti(): BurstConfettiPiece[] {
    if (!this.isBrowser || !this.isSuccess()) return [];
    return Array.from({ length: BURST_CONFETTI_COUNT }, (_, i) => {
      const angle = ((360 / BURST_CONFETTI_COUNT) * i + (Math.random() * 20 - 10)) * (Math.PI / 180);
      const distance = 70 + Math.random() * 50;
      return {
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        rotation: Math.random() * 540 - 270,
      };
    });
  }
}
