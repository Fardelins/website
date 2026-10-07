import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  input,
  output,
  signal,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { ComponentConfig, ShaderInstance } from 'shaders/js';

export type { ComponentConfig } from 'shaders/js';

@Component({
  selector: 'app-shader-background',
  standalone: true,
  templateUrl: './shader-background.html',
  styleUrl: './shader-background.css',
})
export class ShaderBackground implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly prefersReducedMotion =
    this.isBrowser && globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  private readonly canAffordShader = ShaderBackground.deviceCanAffordShader();
  /** Component tree passed straight to `createShader`'s `components` array. */
  readonly preset = input.required<ComponentConfig[]>();
  /** IntersectionObserver `rootMargin`, how early to start loading, to avoid a fallback flash. */
  readonly preloadMargin = input('300px 0px');
  readonly readyChange = output<boolean>();

  @ViewChild('canvas', { static: true })
  private readonly canvasRef!: ElementRef<HTMLCanvasElement>;

  protected readonly ready = signal(false);

  private shader: ShaderInstance | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private loadObserver: IntersectionObserver | null = null;
  private viewReady = false;
  private nearViewport = false;
  private creating = false;
  private stillTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor() {
    effect(() => {
      this.preset();
      if (this.viewReady && this.nearViewport) {
        void this.recreateShader();
      }
    });
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser || typeof globalThis.IntersectionObserver === 'undefined') return;
    this.viewReady = true;
    // createShader otherwise installs fixed inline pixel sizes over responsive CSS.
    this.canvasRef.nativeElement.style.width = '100%';
    this.canvasRef.nativeElement.style.height = '100%';
    // One observer lazy-creates the shader on approach and pauses/resumes on
    // enter/leave, so off-screen shaders never all run at once (jank on weak devices).
    this.loadObserver = new globalThis.IntersectionObserver(
      ([entry]) => this.onIntersection(entry.isIntersecting),
      { rootMargin: this.preloadMargin() },
    );
    this.loadObserver.observe(this.canvasRef.nativeElement);

    // The library's auto-resize misses big aspect-ratio jumps at CSS breakpoints,
    // so drive resize() ourselves off a ResizeObserver.
    if (typeof globalThis.ResizeObserver === 'undefined') return;
    this.resizeObserver = new globalThis.ResizeObserver(() => {
      const { width, height } = this.host.nativeElement.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      this.shader?.resize(width, height);
      if (this.prefersReducedMotion && this.nearViewport) this.renderStill();
    });
    this.resizeObserver.observe(this.host.nativeElement);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.stillTimer !== null) clearTimeout(this.stillTimer);
    this.resizeObserver?.disconnect();
    this.loadObserver?.disconnect();
    this.shader?.destroy();
  }

  private onIntersection(isIntersecting: boolean): void {
    this.nearViewport = isIntersecting;
    if (isIntersecting) {
      if (!this.shader && !this.creating) {
        void this.recreateShader();
      } else if (!this.prefersReducedMotion) {
        this.resume();
      }
    } else {
      this.pause();
    }
  }

  /** Patch a live component's props in place, skips the recreate/reload the `preset` input triggers. */
  update(componentId: string, props: Record<string, unknown>): void {
    this.shader?.update(componentId, props);
  }

  /**
   * Run the loop briefly, then stop it again. Reduced motion pauses for good, so a
   * paused shader would otherwise never paint: textures load asynchronously and prop
   * updates need a frame to reach the canvas. Presets used this way set their own
   * speeds to 0, so the window paints a still image rather than visible motion.
   */
  renderStill(durationMs = 1200): void {
    if (!this.shader) return;
    if (this.stillTimer !== null) clearTimeout(this.stillTimer);
    this.shader.resume();
    this.stillTimer = setTimeout(() => {
      this.shader?.pause();
      this.stillTimer = null;
    }, durationMs);
  }

  /** Stop the animation loop (last frame is preserved). No-op if not yet created. */
  pause(): void {
    this.shader?.pause();
  }

  /** Restart the animation loop after pause(). */
  resume(): void {
    this.shader?.resume();
  }

  // Skip the ~360 KB WebGPU/Three.js download for a decorative background on
  // data-saver, very slow, or low-memory devices (they get the static fallback).
  private static deviceCanAffordShader(): boolean {
    const nav = globalThis.navigator as
      | (Navigator & {
          connection?: { saveData?: boolean; effectiveType?: string };
          deviceMemory?: number;
        })
      | undefined;
    if (!nav) return true;

    if (nav.connection?.saveData) return false;
    const effectiveType = nav.connection?.effectiveType;
    if (effectiveType === '2g' || effectiveType === 'slow-2g') return false;

    // deviceMemory is GiB; under 4 is low-end and struggles with WebGPU.
    if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4) return false;

    return true;
  }

  private async recreateShader(): Promise<void> {
    // Bail before the import on constrained devices, canvas stays at opacity 0 (fallback shows).
    if (!this.canAffordShader || this.creating || this.destroyed) return;

    const preset = this.preset();
    this.creating = true;
    this.shader?.destroy();
    this.shader = null;
    this.ready.set(false);
    this.readyChange.emit(false);

    try {
      const { createShader } = await import('shaders/js');
      if (this.destroyed) return;
      const instance = await createShader(
        this.canvasRef.nativeElement,
        { components: preset },
        {
          disableTelemetry: true,
          observeElement: false,
          onReady: () => {
            if (this.destroyed) return;
            this.ready.set(true);
            this.readyChange.emit(true);
          },
          onError: () => {
            this.ready.set(false);
            this.readyChange.emit(false);
          },
        },
      );
      if (this.destroyed) {
        instance.destroy();
        return;
      }
      this.shader = instance;
      this.shader.resize();
      if (!this.nearViewport) this.shader.pause();
      else if (this.prefersReducedMotion) this.renderStill();
    } catch (error) {
      this.ready.set(false);
      this.readyChange.emit(false);
      console.warn('[shader-background] Keeping the fallback after renderer failure', error);
    } finally {
      this.creating = false;
      if (!this.destroyed && preset !== this.preset()) void this.recreateShader();
    }
  }
}
