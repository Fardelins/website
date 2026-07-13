import { Component, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NewsletterService } from '../../services/newsletter.service';
import { HapticsService } from '../../services/haptics.service';
import { ComponentConfig, ShaderBackground } from '../shader-background/shader-background';

const BLUR_ID = 'cta-zoom-blur';
const BLUR_RESTING = 35;
const BLUR_HOVER_EASE = 0.1;

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
  protected readonly bgShader = viewChild<ShaderBackground>('bgShader');

  private blurTarget = BLUR_RESTING;
  private blurCurrent = BLUR_RESTING;
  private blurRafId: number | null = null;
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
}
