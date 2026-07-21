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
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly prefersReducedMotion =
    this.isBrowser && globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  private readonly canAffordShader = ShaderBackground.deviceCanAffordShader();
  /** Component tree passed straight to `createShader`'s `components` array. */
  readonly preset = input.required<ComponentConfig[]>();
  /** IntersectionObserver `rootMargin` — how early to start loading, to avoid a fallback flash. */
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
    this.resizeObserver = new globalThis.ResizeObserver(() => this.shader?.resize());
    this.resizeObserver.observe(this.canvasRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
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

  /** Patch a live component's props in place — skips the recreate/reload the `preset` input triggers. */
  update(componentId: string, props: Record<string, unknown>): void {
    this.shader?.update(componentId, props);
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
    // Bail before the import on constrained devices — canvas stays at opacity 0 (fallback shows).
    if (!this.canAffordShader) return;

    this.creating = true;
    this.shader?.destroy();
    this.shader = null;
    this.ready.set(false);
    this.readyChange.emit(false);

    // Lazy import: `shaders` pulls in Three.js's WebGPU renderer — keep it out of the initial bundle.
    const { createShader } = await import('shaders/js');
    if (this.destroyed) {
      this.creating = false;
      return;
    }

    this.shader = await createShader(
      this.canvasRef.nativeElement,
      { components: this.preset() },
      {
        disableTelemetry: true,
        observeElement: false,
        onReady: () => {
          this.ready.set(true);
          this.readyChange.emit(true);
        },
      },
    );
    this.creating = false;

    // Don't run if reduced-motion, or if it scrolled out of view during init.
    if (this.prefersReducedMotion || !this.nearViewport) {
      this.shader.pause();
    }
  }
}
