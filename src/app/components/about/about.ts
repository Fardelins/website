import {
  Component,
  ElementRef,
  signal,
  viewChild,
  afterNextRender,
  HostListener,
} from '@angular/core';
import { ComponentConfig, ShaderBackground } from '../shader-background/shader-background';

const ABOUT_TEXT =
  'Fardelins is a delivery and logistics platform helping customers, businesses, dispatchers, ' +
  'and couriers manage deliveries more efficiently. From pickup requests to real-time tracking ' +
  'and fulfillment, we simplify the entire delivery experience from start to finish.';

const BASE_OPACITY = 0.22;

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
      radius: 1.8,
      momentum: 40,
    },
  },
];

const ABERRATION_ID_PREFIX = 'aberration-';
const ABERRATION_HOVER_STRENGTH = 0.5;
const HOVER_EASE = 0.12;

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

const TILT_TRANSLATE_PX = 5;
const TILT_ROTATE_DEG = 1.2;

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [ShaderBackground],
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About {
  protected readonly words = ABOUT_TEXT.split(' ');
  protected readonly textEl = viewChild.required<ElementRef<HTMLElement>>('textEl');
  protected readonly progress = signal(0);

  protected readonly trailPreset = TRAIL_PRESET;
  protected readonly leftImagePreset = imageDistortPreset('/home/left.png', `${ABERRATION_ID_PREFIX}left`);
  protected readonly rightImagePreset = imageDistortPreset('/home/right.png', `${ABERRATION_ID_PREFIX}right`);

  protected readonly leftShader = viewChild<ShaderBackground>('leftShader');
  protected readonly rightShader = viewChild<ShaderBackground>('rightShader');

  protected readonly leftTilt = signal({ x: 0, y: 0 });
  protected readonly rightTilt = signal({ x: 0, y: 0 });

  private readonly hoverStates: Record<ImageSide, HoverState> = {
    left: { target: 0, current: 0, rafId: null },
    right: { target: 0, current: 0, rafId: null },
  };

  constructor() {
    afterNextRender(() => this.updateProgress());
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  protected updateProgress(): void {
    const el = this.textEl().nativeElement;
    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Progress 0 when the text enters from the bottom of the viewport,
    // progress 1 once it nears the top. Reverses on scroll up.
    const start = viewportHeight * 0.9;
    const end = viewportHeight * 0.15;
    const raw = (start - rect.top) / (start - end);
    this.progress.set(Math.min(1, Math.max(0, raw)));
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

  /** Only the hovered image tilts, and only toward its own local cursor position. */
  protected onImagePointerMove(event: PointerEvent, imageEl: HTMLElement, side: ImageSide): void {
    const rect = imageEl.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    (side === 'left' ? this.leftTilt : this.rightTilt).set({ x, y });
  }

  protected onImageLeave(side: ImageSide): void {
    this.setImageHover(side, false);
    (side === 'left' ? this.leftTilt : this.rightTilt).set({ x: 0, y: 0 });
  }

  protected imageTransform(side: ImageSide): string {
    const { x, y } = side === 'left' ? this.leftTilt() : this.rightTilt();
    return `translate(${x * TILT_TRANSLATE_PX}px, ${y * TILT_TRANSLATE_PX}px) rotate(${x * TILT_ROTATE_DEG}deg)`;
  }
}
