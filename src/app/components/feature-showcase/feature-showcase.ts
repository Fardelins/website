import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { TiltDirective } from '../../directives/tilt.directive';
import { ComponentConfig, ShaderBackground } from '../shader-background/shader-background';

const FEATURE_DURATION_MS = 5000;

export interface FeatureShowcaseItem {
  title: string;
  description: string;
}

export interface FeatureShowcaseVisualAsset {
  src: string;
  width: number;
  height: number;
}

export interface FeatureShowcaseLayeredVisual {
  variant: 'tracking' | 'dispatcher' | 'merchant' | 'delivery' | 'courier';
  background: FeatureShowcaseVisualAsset;
  mockup: FeatureShowcaseVisualAsset;
  firstLayer: FeatureShowcaseVisualAsset;
  secondLayer?: FeatureShowcaseVisualAsset;
  thirdLayer?: FeatureShowcaseVisualAsset;
  alt: string;
}

@Component({
  selector: 'app-feature-showcase',
  standalone: true,
  imports: [TiltDirective, ShaderBackground],
  templateUrl: './feature-showcase.html',
  styleUrl: './feature-showcase.css',
})
export class FeatureShowcase implements OnInit, AfterViewInit, OnDestroy {
  readonly sectionId = input.required<string>();
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly accentTitle = input.required<string>();
  readonly imageSrc = input('');
  readonly imageAlt = input('');
  readonly layeredVisual = input<FeatureShowcaseLayeredVisual | null>(null);
  /**
   * Optional live shader that renders over the layered visual's background
   * image. The `background` PNG stays as the SSR / reduced-motion / no-WebGPU
   * fallback; the shader canvas fades in on top once ready.
   */
  readonly shaderPreset = input<ComponentConfig[] | null>(null);
  readonly items = input.required<readonly FeatureShowcaseItem[]>();
  readonly activeIndex = input(0);

  protected readonly currentIndex = signal(0);
  protected readonly activationCycle = signal(0);
  protected readonly durationMs = FEATURE_DURATION_MS;

  private readonly visualScene = viewChild<ElementRef<HTMLElement>>('visualScene');
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly prefersReducedMotion =
    this.isBrowser && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private animationFrameId: number | null = null;

  ngOnInit(): void {
    this.currentIndex.set(this.normalizedIndex(this.activeIndex()));
    this.startTimer();
  }

  ngAfterViewInit(): void {
    this.queueVisualMotion();
  }

  ngOnDestroy(): void {
    this.stopTimer();
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
  }

  protected selectIndex(index: number): void {
    this.activate(index);
    this.startTimer();
  }

  protected itemNumber(index: number): string {
    return String(index + 1).padStart(2, '0');
  }

  /** Derive the AVIF sibling of a generated `.webp` asset for the <picture> source. */
  protected avif(webpSrc: string): string {
    return webpSrc.replace(/\.webp$/i, '.avif');
  }

  private startTimer(): void {
    this.stopTimer();
    if (!this.isBrowser || this.prefersReducedMotion || this.items().length < 2) return;

    this.timerId = setInterval(() => {
      this.activate((this.currentIndex() + 1) % this.items().length);
    }, FEATURE_DURATION_MS);
  }

  private activate(index: number): void {
    this.currentIndex.set(this.normalizedIndex(index));
    this.activationCycle.update((cycle) => cycle + 1);
  }

  private queueVisualMotion(): void {
    if (!this.isBrowser || this.prefersReducedMotion || !this.layeredVisual()) return;
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);

    this.animationFrameId = requestAnimationFrame(() => {
      this.animationFrameId = null;
      const layers =
        this.visualScene()?.nativeElement.querySelectorAll<HTMLElement>('[data-visual-layer]');
      layers?.forEach((layer, index) => {
        const direction = index % 2 === 0 ? -1 : 1;
        layer.animate(
          [
            {
              opacity: 0.72,
              transform: `translate3d(${direction * 14}px, 12px, 0) scale(0.965)`,
            },
            { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
          ],
          {
            duration: 720,
            delay: index * 70,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            fill: 'none',
          },
        );
      });
    });
  }

  private stopTimer(): void {
    if (this.timerId === null) return;
    clearInterval(this.timerId);
    this.timerId = null;
  }

  private normalizedIndex(index: number): number {
    const itemCount = this.items().length;
    if (itemCount === 0) return 0;
    return Math.min(Math.max(index, 0), itemCount - 1);
  }
}
