import { Component, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
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
    children: [{ type: 'ImageTexture', props: { url: '/home/footer.jpg', objectFit: 'cover' } }],
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
  protected readonly year = 2026;

  protected readonly bgPreset = BG_PRESET;
  protected readonly bgShader = viewChild<ShaderBackground>('bgShader');

  private blurTarget = BLUR_RESTING;
  private blurCurrent = BLUR_RESTING;
  private blurRafId: number | null = null;

  protected readonly socialLinks = [
    { label: 'Facebook', href: '#', icon: 'facebook' },
    { label: 'Twitter', href: '#', icon: 'twitter' },
    { label: 'Instagram', href: '#', icon: 'instagram' },
    { label: 'LinkedIn', href: '#', icon: 'linkedin' },
  ];

  protected readonly companyLinks = [
    { label: 'Contact Us', href: '#contact' },
    { label: 'Terms', href: '/terms' },
    { label: 'Privacy Policy', href: '/privacy' },
  ];

  protected scrollToTop(href: string): void {
    if (href === '/terms' || href === '/privacy') window.scrollTo({ top: 0, behavior: 'auto' });
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
