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
  /** Component tree passed straight to `createShader`'s `components` array. */
  readonly preset = input.required<ComponentConfig[]>();
  /**
   * How far ahead of the viewport to start loading the shader, as an
   * IntersectionObserver `rootMargin`. Larger values give the shader more time
   * to become ready before it scrolls into view (avoiding a fallback flash).
   */
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
    this.loadObserver = new globalThis.IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || this.nearViewport) return;
        this.nearViewport = true;
        this.loadObserver?.disconnect();
        void this.recreateShader();
      },
      { rootMargin: this.preloadMargin() },
    );
    this.loadObserver.observe(this.canvasRef.nativeElement);

    // The library's own auto-resize (observeElement) misses the large,
    // abrupt aspect-ratio jumps our CSS breakpoints cause (e.g. desktop
    // widescreen -> phone portrait), leaving the canvas rendered at the
    // stale size. Drive resize() ourselves off a ResizeObserver instead.
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

  private async recreateShader(): Promise<void> {
    this.shader?.destroy();
    this.shader = null;
    this.ready.set(false);
    this.readyChange.emit(false);

    // Loaded on demand — the `shaders` package pulls in Three.js's WebGPU
    // renderer, so keeping it out of the initial bundle matters for first paint.
    const { createShader } = await import('shaders/js');
    if (this.destroyed) {
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

    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      this.shader.pause();
    }
  }
}
