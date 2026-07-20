import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NewsletterService } from '../../services/newsletter.service';
import { HapticsService } from '../../services/haptics.service';
import { ComponentConfig, ShaderBackground } from '../shader-background/shader-background';

// --- Fog scratch-off: the scene sits under a drifting haze (blur + mist). The
// cursor parts the fog locally where it moves; the *accumulated* swiping thins
// it overall, and once you've wiped enough (~ACTIVATION_SWIPES) the fog "lets
// go" and melts away for good. Give up early and it slowly creeps back. The
// rider cutout floats above the fog and stays sharp throughout.
const BLUR_ID = 'cta-diffuse-blur';
const BLUR_RESTING = 22; // medium haze
// Both transitions share the same organic, fog-like exponential ease — the
// dissipate is slower (~5s) than the settle-back (~3s). At ~60fps the time to
// ~99% is roughly 4.6 / (k * 60) seconds.
const DISSIPATE_EASE = 0.015; // ~5s to melt away as you clear it
const REFOG_EASE = 0.026; // ~3s for the fog to settle back in
const REFOG_DELAY_MS = 3000; // grace period after leaving before the fog settles back
const FOG_RESTING_OPACITY = 0.72;
const FOG_CLEAR_OPACITY = 0; // fully dissipated
// How much swiping it takes. A "swipe" is measured as a fraction of the footer
// width, so it scales with the viewport. Clearing latches (melts fully on its
// own) once the accumulated wipe passes ACTIVATE_AT of the full budget.
const ACTIVATION_SWIPES = 7; // full wipe budget
const SWIPE_FRACTION = 0.5; // one swipe ≈ half the footer width
const ACTIVATE_AT = 0.8; // melt latches around swipe ~5–6, before they finish
const PRE_ACTIVATION_CAP = 0.82; // manual wiping thins to here before the melt

// Discoverability: on scroll-in the fog wipes itself once to show it's clearable,
// while a "swipe to reveal" label fades out the moment real wiping begins.
const TEASE_LEVEL = 0.68; // how far the auto-tease thins the fog
const TEASE_EASE = 0.05; // quicker than the manual melt so the demo reads
const TEASE_START_MS = 550; // beat after entering view before the tease
const TEASE_HOLD_MS = 950; // dwell at the thinned peak before resettling
const LOGO_GLASS_ID = 'footer-logo-glass';
const LOGO_WAVE_ID = 'footer-logo-wave';
const LOGO_GRADIENT_ID = 'footer-logo-gradient';
const LOGO_GLASS_SPEED = 0.58;
const LOGO_WAVE_SPEED = 1.3;
const LOGO_GRADIENT_SPEED = 1.05;
const LOGO_HOVER_SPEED = 0.5;
const LOGO_SPEED_EASE = 0.12;

const BG_PRESET: ComponentConfig[] = [
  {
    type: 'DiffuseBlur',
    id: BLUR_ID,
    props: {
      intensity: BLUR_RESTING,
      edges: 'stretch',
    },
    children: [
      { type: 'ImageTexture', props: { url: '/home/footer-1920.webp', objectFit: 'cover' } },
    ],
  },
];

// Standalone mist field, blended over the scene (mix-blend-mode: screen in CSS).
// `mouseInfluence` makes the cursor push the fog aside locally; the ambient
// drift comes from `speed`/`turbulence`. Overall thinning is done in CSS by
// easing the layer's opacity, not by touching the shader.
const FOG_PRESET: ComponentConfig[] = [
  {
    type: 'Fog',
    props: {
      colorA: '#e8ebf0',
      colorB: '#aab4c4',
      seed: 7,
      speed: 0.6,
      turbulence: 0.7,
      detail: 15,
      blending: 0.4,
      mouseInfluence: 0.7,
      mouseRadius: 0.16,
      colorSpace: 'linear',
    },
  },
];

const LOGO_PRESET: ComponentConfig[] = [
  {
    type: 'CursorRipples',
    props: {
      intensity: 2.2,
      decay: 14,
      radius: 0.32,
      chromaticSplit: 0.08,
      edges: 'mirror',
    },
    children: [
      {
        type: 'FlutedGlass',
        id: LOGO_GLASS_ID,
        props: {
          shape: 'waves',
          angle: -18,
          frequency: 3,
          softness: 0.9,
          waveAmplitude: 0.16,
          waveFrequency: 0.72,
          speed: LOGO_GLASS_SPEED,
          refraction: 1.65,
          aberration: 0.14,
          lightAngle: 22,
          highlight: 1.25,
          highlightSoftness: 0.18,
          highlightColor: '#ffffff',
          edges: 'mirror',
        },
        children: [
          {
            type: 'WaveDistortion',
            id: LOGO_WAVE_ID,
            props: {
              strength: 0.72,
              frequency: 1.35,
              speed: LOGO_WAVE_SPEED,
              angle: 28,
              waveType: 'sine',
              edges: 'mirror',
            },
            children: [
              {
                type: 'FlowingGradient',
                id: LOGO_GRADIENT_ID,
                props: {
                  colorA: '#200b3d',
                  colorB: '#521c99',
                  colorC: '#9776c1',
                  colorD: '#ede8f4',
                  colorSpace: 'oklch',
                  speed: LOGO_GRADIENT_SPEED,
                  distortion: 0.9,
                  seed: 14,
                },
              },
            ],
          },
        ],
      },
    ],
  },
];

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [ShaderBackground, RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer implements AfterViewInit, OnDestroy {
  private readonly newsletter = inject(NewsletterService);
  private readonly haptics = inject(HapticsService);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly year = new Date().getFullYear();

  protected readonly bgPreset = BG_PRESET;
  protected readonly fogPreset = FOG_PRESET;
  protected readonly logoPreset = LOGO_PRESET;
  protected readonly bgShader = viewChild<ShaderBackground>('bgShader');
  protected readonly fogShader = viewChild<ShaderBackground>('fogShader');
  protected readonly logoShader = viewChild<ShaderBackground>('logoShader');

  /** 0 = resting haze, 1 = fully dissipated. Drives blur intensity + fog opacity. */
  private clearCurrent = 0;
  private clearTarget = 0; // where the wiping wants it (pre-latch)
  private hovering = false;
  private latched = false; // true once the fog has committed to melting away
  private swipeAccum = 0; // wiped distance in px, resets on full re-fog
  private lastX: number | null = null;
  private lastY: number | null = null;
  private clearRafId: number | null = null;
  private refogTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly fogOpacity = signal(FOG_RESTING_OPACITY);

  /** Discoverability affordances. */
  protected readonly hintVisible = signal(false);
  private teasing = false;
  private teaseTimers: ReturnType<typeof setTimeout>[] = [];
  private revealObserver: IntersectionObserver | null = null;
  private readonly prefersReducedMotion =
    this.isBrowser && matchMedia('(prefers-reduced-motion: reduce)').matches;

  private logoSpeedTarget = 1;

  constructor() {
    // No hover on reduced-motion (shaders are paused): start fully clear so the
    // scene is legible and nothing depends on interaction.
    if (this.prefersReducedMotion) {
      this.latched = true;
      this.clearCurrent = 1;
      this.clearTarget = 1;
      this.fogOpacity.set(FOG_CLEAR_OPACITY);
    }
  }

  ngAfterViewInit(): void {
    // Fire the reveal hint + auto-tease the first time the footer scrolls in.
    if (!this.isBrowser || typeof IntersectionObserver === 'undefined' || this.latched) return;
    this.revealObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        this.revealObserver?.disconnect();
        this.revealObserver = null;
        this.hintVisible.set(true);
        this.autoTease();
      },
      { threshold: 0.4 },
    );
    this.revealObserver.observe(this.host.nativeElement);
  }
  private logoSpeedCurrent = 1;
  private logoSpeedRafId: number | null = null;
  protected readonly subscriptionState = signal<'idle' | 'submitting' | 'success' | 'error'>(
    'idle',
  );

  protected readonly socialLinks = [
    { label: 'Facebook', href: 'https://web.facebook.com/fardelinsng', icon: 'facebook' },
    { label: 'Twitter', href: 'https://twitter.com/fardelins', icon: 'twitter' },
    { label: 'Instagram', href: 'https://www.instagram.com/fardelins/', icon: 'instagram' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/company/fardelins', icon: 'linkedin' },
  ];

  protected readonly companyLinks = [
    { label: 'Contact Us', href: '/contact' },
    { label: 'Terms', href: '/terms' },
    { label: 'Privacy Policy', href: '/privacy' },
  ];

  protected async subscribe(event: SubmitEvent, email: string): Promise<void> {
    event.preventDefault();
    if (this.subscriptionState() === 'submitting') return;
    if (!email.trim()) return;

    const form = event.currentTarget as HTMLFormElement;
    this.haptics.light();

    this.subscriptionState.set('submitting');
    try {
      await this.newsletter.subscribe(email);
      this.subscriptionState.set('success');
      form.reset();
      this.haptics.success();
    } catch {
      this.subscriptionState.set('error');
      this.haptics.error();
    }
  }

  /** Enter/leave the fog. Leaving arms a 3s timer that settles the fog back in. */
  protected setBackgroundHover(hovered: boolean): void {
    this.hovering = hovered;
    this.lastX = this.lastY = null;
    if (hovered) this.cancelTease(); // the user is here now — stop the demo

    if (this.refogTimer !== null) {
      clearTimeout(this.refogTimer);
      this.refogTimer = null;
    }

    // On leave, hold the current state for the grace period, then roll fog back.
    if (!hovered) {
      this.refogTimer = setTimeout(() => {
        this.refogTimer = null;
        this.refog();
      }, REFOG_DELAY_MS);
    }
  }

  /** Reset to a fresh haze — slow, fog-like roll-back. Resumes the paused shader. */
  private refog(): void {
    this.latched = false;
    this.swipeAccum = 0;
    this.lastX = this.lastY = null;
    this.clearTarget = 0;
    this.fogShader()?.resume();
    if (!this.hovering) this.hintVisible.set(true); // fresh fog → offer the hint again
    this.animateClear();
  }

  /** Auto-tease: thin the fog once on scroll-in, then let it resettle, to show it clears. */
  private autoTease(): void {
    if (this.prefersReducedMotion || this.hovering || this.latched) return;
    this.teaseTimers.push(
      setTimeout(() => {
        if (this.hovering || this.latched) return;
        this.teasing = true;
        this.clearTarget = TEASE_LEVEL;
        this.animateClear();
        this.teaseTimers.push(
          setTimeout(() => {
            if (this.hovering || this.latched) return;
            this.clearTarget = 0; // resettle the haze
            this.animateClear();
            this.teaseTimers.push(setTimeout(() => (this.teasing = false), 1500));
          }, TEASE_HOLD_MS),
        );
      }, TEASE_START_MS),
    );
  }

  private cancelTease(): void {
    this.teasing = false;
    for (const t of this.teaseTimers) clearTimeout(t);
    this.teaseTimers = [];
  }

  ngOnDestroy(): void {
    if (this.refogTimer !== null) clearTimeout(this.refogTimer);
    if (this.clearRafId !== null) cancelAnimationFrame(this.clearRafId);
    this.revealObserver?.disconnect();
    this.cancelTease();
  }

  /** Every wipe accumulates distance; enough of it melts the fog for good. */
  protected wipe(event: PointerEvent): void {
    if (this.latched) return;
    this.cancelTease();
    this.hintVisible.set(false); // real interaction started — drop the prompt

    const el = event.currentTarget as HTMLElement;
    const swipeLen = el.clientWidth * SWIPE_FRACTION || 1;
    const budget = ACTIVATION_SWIPES * swipeLen; // px of wiping for a full clear

    if (this.lastX !== null && this.lastY !== null) {
      this.swipeAccum += Math.hypot(event.clientX - this.lastX, event.clientY - this.lastY);
    }
    this.lastX = event.clientX;
    this.lastY = event.clientY;

    const progress = this.swipeAccum / budget;
    this.clearTarget = Math.min(PRE_ACTIVATION_CAP, progress);

    // Wiped enough — the fog commits and finishes dissipating on its own.
    if (progress >= ACTIVATE_AT) {
      this.latched = true;
      this.clearTarget = 1;
      this.haptics.success();
    }

    this.animateClear();
  }

  /** Ease blur toward 0 and fog toward transparent; pause the fog shader once gone. */
  private animateClear(): void {
    if (this.clearRafId !== null) return;

    const step = (): void => {
      // The auto-tease reads quicker; otherwise slow melt out, quicker settle back.
      const easing = this.teasing
        ? TEASE_EASE
        : this.clearTarget < this.clearCurrent
          ? REFOG_EASE
          : DISSIPATE_EASE;
      this.clearCurrent += (this.clearTarget - this.clearCurrent) * easing;

      this.bgShader()?.update(BLUR_ID, { intensity: BLUR_RESTING * (1 - this.clearCurrent) });
      this.fogOpacity.set(
        FOG_RESTING_OPACITY + (FOG_CLEAR_OPACITY - FOG_RESTING_OPACITY) * this.clearCurrent,
      );

      // Fully dissipated: stop the fog GPU work until it's summoned back.
      if (this.latched && this.clearCurrent > 0.999) {
        this.clearCurrent = 1;
        this.fogOpacity.set(FOG_CLEAR_OPACITY);
        this.fogShader()?.pause();
        this.clearRafId = null;
        return;
      }

      const settled = Math.abs(this.clearTarget - this.clearCurrent) < 0.001;
      this.clearRafId = settled ? null : requestAnimationFrame(step);
    };
    this.clearRafId = requestAnimationFrame(step);
  }

  /** Ease every animated material layer to half-speed while the logo is hovered. */
  protected setLogoHover(hovered: boolean): void {
    this.logoSpeedTarget = hovered ? LOGO_HOVER_SPEED : 1;
    if (this.logoSpeedRafId !== null) {
      return;
    }

    const step = (): void => {
      this.logoSpeedCurrent += (this.logoSpeedTarget - this.logoSpeedCurrent) * LOGO_SPEED_EASE;

      const shader = this.logoShader();
      shader?.update(LOGO_GLASS_ID, { speed: LOGO_GLASS_SPEED * this.logoSpeedCurrent });
      shader?.update(LOGO_WAVE_ID, { speed: LOGO_WAVE_SPEED * this.logoSpeedCurrent });
      shader?.update(LOGO_GRADIENT_ID, { speed: LOGO_GRADIENT_SPEED * this.logoSpeedCurrent });

      const settled = Math.abs(this.logoSpeedTarget - this.logoSpeedCurrent) < 0.002;
      this.logoSpeedRafId = settled ? null : requestAnimationFrame(step);
    };

    this.logoSpeedRafId = requestAnimationFrame(step);
  }
}
