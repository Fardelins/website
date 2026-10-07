import {
  Component,
  OnDestroy,
  PLATFORM_ID,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { solarArrowRightBoldDuotone } from '@ng-icons/solar-icons/bold-duotone';
import {
  ComponentConfig,
  ShaderBackground,
} from '@shared/components/shader-background/shader-background';

export type AuthArt = 'glass-stack' | 'glass-spiral' | 'chrome-ribbon' | 'horizon';

const ART_ALT: Record<AuthArt, string> = {
  'glass-stack': 'Stacked panes of blue glass',
  'glass-spiral': 'A clear glass ribbon coiled into a spiral',
  'chrome-ribbon': 'A polished chrome ribbon folding over itself',
  horizon: 'A soft blue horizon fading into cloud',
};

const MEMBER_AVATARS = [1, 2, 3, 4, 5];
const AVATARS_SHOWN = 4;

/** Fresh order per mount so the stack isn't the same five faces in the same order. */
function shuffledAvatars(): number[] {
  const pool = [...MEMBER_AVATARS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, AVATARS_SHOWN);
}

interface CopyToken {
  text: string;
  accent: boolean;
  suffix?: string;
}

// Splits into words rather than characters: keeps the accent word's own styling intact
// and stays close to the source component's `splitBy="word"` mode, without its GSAP cost.
function tokenize(lead: string, accent: string, tail: string): CopyToken[] {
  const words = (value: string): CopyToken[] =>
    value
      .split(/\s+/)
      .filter(Boolean)
      .map((text) => ({ text, accent: false }));
  // Punctuation opening the tail rides on the accent word: as its own token it would
  // become a separate inline-block and render as "Fardelins ." with a gap.
  const [, cling = '', rest = ''] = /^([^\s\w]*)([\s\S]*)$/.exec(tail) ?? [];
  return [...words(lead), { text: accent, accent: true, suffix: cling }, ...words(rest)];
}

const ABERRATION_ID = 'auth-aberration';
const WAVE_ID = 'auth-wave';
const GLITCH_ID = 'auth-glitch';

const WAVE_REST = 0.03;
const WAVE_HOVER = 0.14;
const ABERRATION_REST = 0;
const ABERRATION_HOVER = 0.35;
const HOVER_EASE = 0.12;

const GLITCH_REST = { intensity: 0, rgbShift: 0, colorBarIntensity: 0, scanlineIntensity: 0 };
// Hover sits well under the entrance peak: a live signal, not a broken screen.
const GLITCH_HOVER = {
  intensity: 0.3,
  rgbShift: 3.5,
  colorBarIntensity: 0.05,
  scanlineIntensity: 0.07,
};

function presetFor(url: string, still: boolean): ComponentConfig[] {
  return [
    {
      type: 'ChromaticAberration',
      id: ABERRATION_ID,
      props: { strength: ABERRATION_REST, angle: 0 },
      children: [
        {
          type: 'Glitch',
          id: GLITCH_ID,
          props: { ...GLITCH_REST, blockDensity: 14, mirrorAmount: 0.15 },
          children: [
            {
              type: 'WaveDistortion',
              id: WAVE_ID,
              props: {
                strength: WAVE_REST,
                frequency: 1.3,
                speed: still ? 0 : 0.28,
                angle: 18,
                waveType: 'sine',
                edges: 'mirror',
              },
              children: [
                {
                  // Grades the cool source imagery toward brand purple without flattening
                  // the chrome; sits under the distortion so the fringes stay colored.
                  type: 'Tint',
                  props: { color: '#8a38f5', amount: 0.22, preserveLuminosity: true },
                  children: [{ type: 'ImageTexture', props: { url, objectFit: 'cover' } }],
                },
              ],
            },
          ],
        },
      ],
    },
  ];
}

@Component({
  selector: 'app-auth-panel',
  imports: [RouterLink, NgIcon, ShaderBackground],
  viewProviders: [provideIcons({ solarArrowRightBoldDuotone })],
  templateUrl: './auth-panel.html',
  styleUrl: './auth-panel.css',
})
export class AuthPanel implements OnDestroy {
  readonly art = input.required<AuthArt>();
  readonly lead = input.required<string>();
  readonly accent = input<string>('Fardelins');
  readonly tail = input<string>('');
  readonly proof = input<string>('');

  protected readonly avatars = shuffledAvatars();
  protected readonly alt = computed(() => ART_ALT[this.art()]);
  protected readonly src = computed(() => `/auth/${this.art()}`);
  protected readonly preset = computed(() => presetFor(`${this.src()}-900.webp`, this.stillArt));
  protected readonly copyTokens = computed(() => tokenize(this.lead(), this.accent(), this.tail()));
  // What a screen reader hears, the fold-word spans underneath are aria-hidden.
  protected readonly copyText = computed(() => `${this.lead()} ${this.accent()}${this.tail()}`);

  private readonly shaderRef = viewChild<ShaderBackground>('shader');

  // Reduced motion silences the *ambient* wave, but hover is direct manipulation:
  // it still responds, just snapped to its target instead of eased into it.
  private readonly stillArt =
    isPlatformBrowser(inject(PLATFORM_ID)) &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  private hovered = false;
  private aberration = ABERRATION_REST;
  private wave = WAVE_REST;
  private glitch = 0;
  private rafId: number | null = null;

  ngOnDestroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
  }

  protected setHover(hovered: boolean): void {
    this.hovered = hovered;

    if (this.stillArt) {
      this.wave = hovered ? WAVE_HOVER : WAVE_REST;
      this.aberration = hovered ? ABERRATION_HOVER : ABERRATION_REST;
      this.shaderRef()?.update(WAVE_ID, { strength: this.wave });
      this.shaderRef()?.update(ABERRATION_ID, { strength: this.aberration });
      this.shaderRef()?.renderStill(600);
      return;
    }

    if (this.rafId !== null) return;

    const step = (): void => {
      const waveTarget = this.hovered ? WAVE_HOVER : WAVE_REST;
      const aberrationTarget = this.hovered ? ABERRATION_HOVER : ABERRATION_REST;
      const glitchTarget = this.hovered ? 1 : 0;

      this.wave += (waveTarget - this.wave) * HOVER_EASE;
      this.aberration += (aberrationTarget - this.aberration) * HOVER_EASE;
      this.glitch += (glitchTarget - this.glitch) * HOVER_EASE;
      this.shaderRef()?.update(WAVE_ID, { strength: this.wave });
      this.shaderRef()?.update(ABERRATION_ID, { strength: this.aberration });
      this.shaderRef()?.update(GLITCH_ID, {
        intensity: GLITCH_HOVER.intensity * this.glitch,
        rgbShift: GLITCH_HOVER.rgbShift * this.glitch,
        colorBarIntensity: GLITCH_HOVER.colorBarIntensity * this.glitch,
        scanlineIntensity: GLITCH_HOVER.scanlineIntensity * this.glitch,
      });

      const settled =
        Math.abs(waveTarget - this.wave) < 0.002 &&
        Math.abs(aberrationTarget - this.aberration) < 0.002 &&
        Math.abs(glitchTarget - this.glitch) < 0.002;
      this.rafId = settled ? null : requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }
}
