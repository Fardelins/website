import { Component, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NewsletterService } from '../../services/newsletter.service';
import { HapticsService } from '../../services/haptics.service';
import { ComponentConfig, ShaderBackground } from '../shader-background/shader-background';

const BLUR_ID = 'cta-zoom-blur';
const BLUR_RESTING = 35;
const BLUR_HOVER_EASE = 0.1;
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
    type: 'ZoomBlur',
    id: BLUR_ID,
    props: {
      intensity: BLUR_RESTING,
      center: { x: 0.56, y: 0.55 },
    },
    children: [{ type: 'ImageTexture', props: { url: '/home/footer-1920.webp', objectFit: 'cover' } }],
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
export class Footer {
  private readonly newsletter = inject(NewsletterService);
  private readonly haptics = inject(HapticsService);
  protected readonly year = new Date().getFullYear();

  protected readonly bgPreset = BG_PRESET;
  protected readonly logoPreset = LOGO_PRESET;
  protected readonly bgShader = viewChild<ShaderBackground>('bgShader');
  protected readonly logoShader = viewChild<ShaderBackground>('logoShader');

  private blurTarget = BLUR_RESTING;
  private blurCurrent = BLUR_RESTING;
  private blurRafId: number | null = null;
  private logoSpeedTarget = 1;
  private logoSpeedCurrent = 1;
  private logoSpeedRafId: number | null = null;
  protected readonly subscriptionState = signal<'idle' | 'submitting' | 'success' | 'error'>('idle');

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

  /** Blur eases toward 0 while hovering, and back to resting once the cursor leaves. */
  protected setBackgroundHover(hovered: boolean): void {
    this.blurTarget = hovered ? 0 : BLUR_RESTING;
    if (this.blurRafId !== null) {
      return;
    }
    const step = (): void => {
      this.blurCurrent += (this.blurTarget - this.blurCurrent) * BLUR_HOVER_EASE;
      this.bgShader()?.update(BLUR_ID, { intensity: this.blurCurrent });

      const settled = Math.abs(this.blurTarget - this.blurCurrent) < 0.05;
      this.blurRafId = settled ? null : requestAnimationFrame(step);
    };
    this.blurRafId = requestAnimationFrame(step);
  }

  /** Ease every animated material layer to half-speed while the logo is hovered. */
  protected setLogoHover(hovered: boolean): void {
    this.logoSpeedTarget = hovered ? LOGO_HOVER_SPEED : 1;
    if (this.logoSpeedRafId !== null) {
      return;
    }

    const step = (): void => {
      this.logoSpeedCurrent +=
        (this.logoSpeedTarget - this.logoSpeedCurrent) * LOGO_SPEED_EASE;

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
