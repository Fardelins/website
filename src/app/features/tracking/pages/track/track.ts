import {
  Component,
  ElementRef,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideChevronDown,
  lucideCircleCheck,
  lucideCircleDashed,
  lucideCopy,
  lucideLoaderCircle,
  lucideMapPin,
  lucideRefreshCw,
} from '@ng-icons/lucide';
import { TextMorph } from 'torph';
import { animate } from 'motion/mini';
import {
  ComponentConfig,
  ShaderBackground,
} from '@shared/components/shader-background/shader-background';
import { HapticsService } from '@core/services/haptics.service';
import { SITE_NAME, SeoService } from '@core/services/seo.service';
import { TRACKING_PHASES, TrackingResult } from '../../tracking.model';
import { TrackingService } from '../../tracking.service';
import { trackDate, trackItems, trackPackage, trackTime } from '../../tracking.icons';

const COPIED_RESET_MS = 1800;

// Pointer-driven colour smoke, same preset as the home page's About section.
const HERO_TRAIL_PRESET: ComponentConfig[] = [
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

// Same ASCII treatment as the home page's About section, re-lettered to FARDELINS.
const HERO_ASCII_PRESET: ComponentConfig[] = [
  {
    type: 'Ascii',
    props: {
      characters: 'FARDELINS',
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

@Component({
  selector: 'app-track',
  imports: [RouterLink, NgIcon, ShaderBackground],
  viewProviders: [
    provideIcons({
      lucideCircleCheck,
      lucideLoaderCircle,
      lucideCircleDashed,
      lucideCopy,
      lucideCheck,
      lucideRefreshCw,
      lucideChevronDown,
      lucideMapPin,
      trackPackage,
      trackDate,
      trackItems,
      trackTime,
    }),
  ],
  templateUrl: './track.html',
  styleUrl: './track.css',
})
export class Track {
  private readonly trackingService = inject(TrackingService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly haptics = inject(HapticsService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly headlineRef = viewChild<ElementRef<HTMLElement>>('headlineEl');
  private readonly fillRefs = viewChildren<ElementRef<HTMLElement>>('fillEl');
  private readonly resultsTopRef = viewChild<ElementRef<HTMLElement>>('resultsTop');
  private headlineMorph?: TextMorph;
  private headlineMorphElement?: HTMLElement;
  private firstResultSeen = false;
  private previousResult: TrackingResult | null = null;
  private wasShowingResults = false;

  private copyResetId: ReturnType<typeof setTimeout> | null = null;
  private toastId: ReturnType<typeof setTimeout> | null = null;

  protected readonly phases = TRACKING_PHASES;
  protected readonly heroTrailPreset = HERO_TRAIL_PRESET;
  protected readonly heroAsciiPreset = HERO_ASCII_PRESET;

  protected readonly query = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal(false);
  protected readonly notFound = signal(false);
  protected readonly result = signal<TrackingResult | null>(null);
  protected readonly copied = signal(false);
  protected readonly toast = signal<string | null>(null);
  protected readonly timelineOpen = signal(true);

  /** Both set once per shipment; later updates go through torph/motion instead, so
   *  Angular's own change detection never fights those animations for the DOM. */
  protected readonly headlineText = signal('');
  protected readonly barScales = signal<number[]>(TRACKING_PHASES.map(() => 0));

  /** Keeps the results section out of the DOM entirely before the first lookup. */
  protected readonly hasContent = computed(
    () => this.loading() || this.error() || this.notFound() || this.result() !== null,
  );

  private readonly fetchedAt = signal<Date | null>(null);
  protected readonly fetchedLabel = computed(() => {
    const date = this.fetchedAt();
    return date ? formatFetched(date) : '';
  });

  constructor() {
    this.seo.update({
      title: `Track your order | ${SITE_NAME}`,
      description:
        'Enter your Fardelins tracking number to see your parcel’s status and delivery progress.',
      path: '/track',
      robots: 'noindex, follow', // per-shipment results shouldn't be indexed
    });

    // Deep-linkable: /track/:trackingId auto-loads and stays shareable.
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('trackingId');
      if (id) {
        this.query.set(id);
        void this.load(id);
      }
    });

    // The hero fills the viewport, so a fresh search needs a nudge to reveal
    // what just loaded underneath it.
    effect(() => {
      const showing = this.hasContent();
      if (showing && !this.wasShowingResults && this.isBrowser) {
        requestAnimationFrame(() => {
          const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
          this.resultsTopRef()?.nativeElement.scrollIntoView({
            behavior: reduced ? 'auto' : 'smooth',
            block: 'start',
          });
        });
      }
      this.wasShowingResults = showing;
    });

    effect(() => {
      const r = this.result();
      if (!r) {
        this.previousResult = null;
        return;
      }

      if (!this.firstResultSeen) {
        this.firstResultSeen = true;
        this.headlineText.set(r.headline);
        this.barScales.set(this.phases.map((_, i) => this.phaseFraction(i, r)));
        this.previousResult = r;
        return;
      }

      const old = this.previousResult;
      this.previousResult = r;
      this.morphHeadline(r.headline);
      if (this.isBrowser && old) void this.animateBars(old, r);
    });
  }

  protected submit(): void {
    const id = this.query().trim();
    if (!id) return;
    // Push the id into the URL; the paramMap subscription performs the load.
    void this.router.navigate(['/track', id]);
  }

  protected clear(): void {
    this.query.set('');
    this.result.set(null);
    this.firstResultSeen = false;
    this.headlineText.set('');
    this.barScales.set(this.phases.map(() => 0));
    this.searchedReset();
    void this.router.navigate(['/track']);
  }

  protected retry(): void {
    const id = this.query().trim();
    if (id) void this.load(id);
  }

  protected refresh(): void {
    this.haptics.light();
    const id = this.result()?.trackingId ?? this.query().trim();
    if (id && !this.loading()) void this.load(id);
  }

  protected async copy(): Promise<void> {
    const id = this.result()?.trackingId;
    if (!id) return;
    // Fire haptics before awaiting so iOS still has user activation.
    this.haptics.light();
    try {
      await navigator.clipboard.writeText(id);
      this.copied.set(true);
      this.showToast('Tracking number copied');
      if (this.copyResetId) clearTimeout(this.copyResetId);
      this.copyResetId = setTimeout(() => this.copied.set(false), COPIED_RESET_MS);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  protected toggleTimeline(): void {
    this.timelineOpen.update((open) => !open);
    this.haptics.selection();
  }

  protected stepDone(index: number, result: TrackingResult): boolean {
    return (
      index < result.currentPhaseIndex || (index === result.currentPhaseIndex && result.delivered)
    );
  }

  protected stepCurrent(index: number, result: TrackingResult): boolean {
    return index === result.currentPhaseIndex && !result.delivered;
  }

  /** Bar fill for phase `index`: done → 1, active → measured fraction, upcoming → 0. */
  private phaseFraction(index: number, result: TrackingResult): number {
    if (index < result.currentPhaseIndex) return 1;
    if (index === result.currentPhaseIndex)
      return result.delivered ? 1 : result.currentPhaseProgress;
    return 0;
  }

  /** Spring-fills bars in sequence: any phase the shipment just finished catches up to full
   *  before the new current phase starts filling — a wave rather than everything moving at once. */
  private async animateBars(old: TrackingResult, next: TrackingResult): Promise<void> {
    const fills = this.fillRefs().map((ref) => ref.nativeElement);
    if (fills.length === 0) return;

    const target = next.delivered ? 1 : next.currentPhaseProgress;
    const spring = { type: 'spring', stiffness: 260, damping: 28, mass: 0.9 } as const;

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      fills.forEach((el, i) => {
        el.style.transform = `scaleX(${this.phaseFraction(i, next)})`;
      });
      return;
    }

    // Phases now ahead of the shipment drain back to empty (mock loops, or a status correction).
    for (let i = fills.length - 1; i > next.currentPhaseIndex; i--) {
      void animate(fills[i], { transform: 'scaleX(0)' }, spring);
    }

    const start = Math.max(Math.min(old.currentPhaseIndex, next.currentPhaseIndex), 0);
    for (let i = start; i < next.currentPhaseIndex; i++) {
      await animate(fills[i], { transform: 'scaleX(1)' }, spring);
    }
    await animate(fills[next.currentPhaseIndex], { transform: `scaleX(${target})` }, spring);
  }

  private morphHeadline(text: string): void {
    if (!this.isBrowser) return;
    const element = this.headlineRef()?.nativeElement;
    if (!element) return;
    if (this.headlineMorphElement !== element) this.headlineMorph = undefined;
    this.headlineMorphElement = element;
    this.headlineMorph ??= new TextMorph({ element, duration: 420 });
    this.headlineMorph.update(text);
  }

  private showToast(message: string): void {
    this.toast.set(message);
    if (this.toastId) clearTimeout(this.toastId);
    this.toastId = setTimeout(() => this.toast.set(null), COPIED_RESET_MS);
  }

  private searchedReset(): void {
    this.notFound.set(false);
    this.error.set(false);
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.searchedReset();
    try {
      const result = await this.trackingService.track(id);
      this.result.set(result);
      this.notFound.set(result === null);
      if (result) this.fetchedAt.set(new Date());
    } catch {
      this.error.set(true);
      this.result.set(null);
    } finally {
      this.loading.set(false);
    }
  }
}

function formatFetched(date: Date): string {
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const sameDay = date.toDateString() === new Date().toDateString();
  if (sameDay) return `Today at ${time}`;
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
}
