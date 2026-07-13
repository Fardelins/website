import { isPlatformBrowser } from '@angular/common';
import { Component, OnDestroy, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { ComponentConfig, ShaderBackground } from '../shader-background/shader-background';

const LOGO_URL = '/home/logo.svg';
const STAGE_INTERVAL_MS = 1400;

/** Filters cycled over the logo — each stage swaps `ShaderBackground`'s whole preset, which
 * triggers its built-in recreate + fade-in, giving the loader a "materializing" feel for free. */
const STAGES: ComponentConfig[][] = [
  [
    {
      type: 'Dither',
      props: {
        pattern: 'bayer4',
        pixelSize: 5,
        threshold: 0.5,
        spread: 1,
        colorMode: 'custom',
        colorA: 'transparent',
        colorB: '#521C99',
      },
      children: [{ type: 'ImageTexture', props: { url: LOGO_URL, objectFit: 'contain' } }],
    },
  ],
  [
    {
      type: 'Ascii',
      props: { characters: '@%#*+=-:.', cellSize: 14, fontFamily: 'JetBrains', spacing: 1, gamma: 1, alphaThreshold: 0.1 },
      children: [{ type: 'ImageTexture', props: { url: LOGO_URL, objectFit: 'contain' } }],
    },
  ],
  [
    {
      type: 'Pixelate',
      props: { scale: 28, gap: 0.08, roundness: 0.3 },
      children: [{ type: 'ImageTexture', props: { url: LOGO_URL, objectFit: 'contain' } }],
    },
  ],
];

@Component({
  selector: 'app-blog-loader',
  imports: [ShaderBackground],
  templateUrl: './blog-loader.html',
  styleUrl: './blog-loader.css',
})
export class BlogLoader implements OnInit, OnDestroy {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly stageIndex = signal(0);
  protected readonly preset = computed(() => STAGES[this.stageIndex()]);

  private intervalId: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    if (!this.isBrowser || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    this.intervalId = setInterval(() => {
      this.stageIndex.update((i) => (i + 1) % STAGES.length);
    }, STAGE_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.intervalId !== null) clearInterval(this.intervalId);
  }
}
