import {
  Component,
  ElementRef,
  signal,
  viewChild,
  afterNextRender,
  HostListener,
  inject,
} from '@angular/core';
import { ComponentConfig, ShaderBackground } from '../shader-background/shader-background';
import { TiltDirective } from '../../directives/tilt.directive';
import { HapticsService } from '../../services/haptics.service';

const ABOUT_TEXT =
  'Fardelins is a delivery and logistics platform helping customers, businesses, dispatchers, ' +
  'and couriers manage deliveries more efficiently. From pickup requests to real-time tracking ' +
  'and fulfillment, we simplify the entire delivery experience from start to finish.';

const BASE_OPACITY = 0.22;
const REVEAL_CHECKPOINT_WORDS = [6, 12, 16, 24, 34] as const;
const TOUCH_SCROLL_WINDOW_MS = 4000;

// Brand purple carries the effect (baseColor + 3 of 4 flow directions); blue is
// the lone accent so the trail reads as "on-brand" rather than a rainbow.
const TRAIL_PRESET: ComponentConfig[] = [
  {
    type: 'ChromaFlow',
    props: {
      baseColor: '#521c99',
      upColor: '#8a38f5',
      downColor: '#31105b',
      leftColor: '#6a1fd0',
      rightColor: '#0099ff',
      intensity: 1.2,
      radius: 3.4,
      momentum: 40,
    },
  },
];

const ASCII_PRESET: ComponentConfig[] = [
  {
    type: 'Ascii',
    props: {
      characters: 'FARDELINSBAMI.: ',
      cellSize: 10,
      fontFamily: 'IBM',
      spacing: 0.72,
      gamma: 0.92,
      alphaThreshold: 0,
      preserveAlpha: true,
    },
    children: [
      {
        type: 'FractalNoise',
        props: {
          colorA: '#b894e8',
          colorB: '#000000',
          octaves: 3,
          detail: 2,
          contrast: 0.58,
          speed: 0.12,
          angle: 8,
          seed: 17,
          colorSpace: 'linear',
        },
      },
    ],
  },
];

const ABERRATION_ID_PREFIX = 'aberration-';
const ABERRATION_HOVER_STRENGTH = 0.5;
const HOVER_EASE = 0.12;
// (3D pointer-tilt is handled by the shared [appTilt] directive.)

function imageDistortPreset(url: string, aberrationId: string): ComponentConfig[] {
  return [
    {
      type: 'ChromaticAberration',
      id: aberrationId,
      props: { strength: 0, angle: 0 },
      children: [
        {
          type: 'GridDistortion',
          props: { intensity: 2.5, decay: 4, radius: 2.4, gridSize: 24, edges: 'stretch' },
          children: [{ type: 'ImageTexture', props: { url, objectFit: 'cover' } }],
        },
      ],
    },
  ];
}

type ImageSide = 'left' | 'right';

interface HoverState {
  target: number;
  current: number;
  rafId: number | null;
}

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [ShaderBackground, TiltDirective],
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About {
  private readonly haptics = inject(HapticsService);
  protected readonly words = ABOUT_TEXT.split(' ');
  protected readonly textEl = viewChild.required<ElementRef<HTMLElement>>('textEl');
  protected readonly progress = signal(0);

  protected readonly trailPreset = TRAIL_PRESET;
  protected readonly asciiPreset = ASCII_PRESET;
  protected readonly leftImagePreset = imageDistortPreset(
    '/home/left-800.webp',
    `${ABERRATION_ID_PREFIX}left`,
  );
  protected readonly rightImagePreset = imageDistortPreset(
    '/home/right-800.webp',
    `${ABERRATION_ID_PREFIX}right`,
  );

  protected readonly leftShader = viewChild<ShaderBackground>('leftShader');
  protected readonly rightShader = viewChild<ShaderBackground>('rightShader');

  private readonly hoverStates: Record<ImageSide, HoverState> = {
    left: { target: 0, current: 0, rafId: null },
    right: { target: 0, current: 0, rafId: null },
  };
  private readonly firedCheckpoints = new Set<number>();
  private previousProgress = 0;
  private lastTouchScrollAt = Number.NEGATIVE_INFINITY;
  private reducedMotion = false;

  constructor() {
    afterNextRender(() => {
      this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.updateProgress(false);
    });
  }

  @HostListener('window:scroll')
  protected onWindowScroll(): void {
    this.updateProgress(true);
  }

  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.updateProgress(false);
  }

  @HostListener('document:pointerdown', ['$event'])
  @HostListener('document:pointerup', ['$event'])
  @HostListener('document:pointercancel', ['$event'])
  protected noteScrollGesture(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') this.lastTouchScrollAt = performance.now();
  }

  private updateProgress(fromScroll: boolean): void {
    if (this.reducedMotion) {
      this.progress.set(1);
      this.previousProgress = 1;
      return;
    }

    const el = this.textEl().nativeElement;
    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Progress 0 when the text enters from the bottom of the viewport,
    // progress 1 once it nears the top. Reverses on scroll up.
    const start = viewportHeight * 0.9;
    const end = viewportHeight * 0.15;
    const raw = (start - rect.top) / (start - end);
    const nextProgress = Math.min(1, Math.max(0, raw));

    if (fromScroll) this.syncRevealHaptics(this.previousProgress, nextProgress);
    this.progress.set(nextProgress);
    this.previousProgress = nextProgress;
  }

  private syncRevealHaptics(previous: number, next: number): void {
    if (next <= 0.01) this.firedCheckpoints.clear();
    if (next <= previous || performance.now() - this.lastTouchScrollAt > TOUCH_SCROLL_WINDOW_MS)
      return;

    const crossed = REVEAL_CHECKPOINT_WORDS.filter((wordIndex) => {
      const threshold = this.wordRevealThreshold(wordIndex);
      return !this.firedCheckpoints.has(wordIndex) && previous < threshold && next >= threshold;
    });

    if (!crossed.length) return;
    crossed.forEach((wordIndex) => this.firedCheckpoints.add(wordIndex));
    this.haptics.selection();
  }

  private wordRevealThreshold(index: number): number {
    const revealWindow = 1.4 / this.words.length;
    const start = (index / (this.words.length - 1)) * (1 - revealWindow);
    return start + revealWindow * 0.5;
  }

  protected wordOpacity(index: number): number {
    const total = this.words.length;
    const revealWindow = 1.4 / total;
    // Normalized so the last word's window always ends exactly at progress = 1,
    // otherwise it never reaches full opacity (it'd cap out partway through).
    const start = (index / (total - 1)) * (1 - revealWindow);
    const local = Math.min(1, Math.max(0, (this.progress() - start) / revealWindow));
    return BASE_OPACITY + local * (1 - BASE_OPACITY);
  }

  protected setImageHover(side: ImageSide, hovered: boolean): void {
    this.hoverStates[side].target = hovered ? ABERRATION_HOVER_STRENGTH : 0;
    this.startHoverLoop(side);
  }

  private startHoverLoop(side: ImageSide): void {
    const state = this.hoverStates[side];
    if (state.rafId !== null) {
      return;
    }
    const shaderRef = side === 'left' ? this.leftShader() : this.rightShader();
    const componentId = `${ABERRATION_ID_PREFIX}${side}`;

    const step = (): void => {
      state.current += (state.target - state.current) * HOVER_EASE;
      shaderRef?.update(componentId, { strength: state.current });

      const settled = Math.abs(state.target - state.current) < 0.002;
      state.rafId = settled ? null : requestAnimationFrame(step);
    };
    state.rafId = requestAnimationFrame(step);
  }
}
