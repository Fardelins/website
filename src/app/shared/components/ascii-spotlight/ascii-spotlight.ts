import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  afterNextRender,
  inject,
  input,
} from '@angular/core';

const WORD = 'FARDELINS';
const TEXTURE_COLS = 340;
const TEXTURE_ROWS = 88;

/** Dense brand-letter texture; the real lockup SVG clips it into the complete logo shape. */
function renderLogoTexture(): string {
  return Array.from({ length: TEXTURE_ROWS }, (_, row) =>
    Array.from(
      { length: TEXTURE_COLS },
      (_, column) => WORD[(column * 5 + row * 7) % WORD.length],
    ).join(''),
  ).join('\n');
}

/**
 * A spotlight sweeps the panel. The grid and ASCII-filled logo share one radial mask,
 * so pointer movement changes one custom property rather than touching every character.
 */
@Component({
  selector: 'app-ascii-spotlight',
  templateUrl: './ascii-spotlight.html',
  styleUrl: './ascii-spotlight.css',
})
export class AsciiSpotlight implements OnDestroy {
  readonly label = input<string>('');

  protected readonly logoTexture = renderLogoTexture();

  private readonly host = inject(ElementRef<HTMLElement>).nativeElement;
  private rafId: number | null = null;
  private tracking = false;

  constructor() {
    afterNextRender(() => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      this.drift();
    });
  }

  ngOnDestroy(): void {
    this.stop();
  }

  @HostListener('pointermove', ['$event'])
  protected track(event: PointerEvent): void {
    const rect = this.host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.tracking = true;
    this.stop();
    this.place(
      ((event.clientX - rect.left) / rect.width) * 100,
      ((event.clientY - rect.top) / rect.height) * 100,
    );
  }

  @HostListener('pointerleave')
  protected release(): void {
    this.tracking = false;
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) this.drift();
  }

  private place(x: number, y: number): void {
    this.host.style.setProperty('--mx', `${x}%`);
    this.host.style.setProperty('--my', `${y}%`);
  }

  // Lissajous, so the idle sweep never retraces the same path on a short loop.
  private drift(): void {
    if (this.rafId !== null) return;
    const loop = (now: number): void => {
      if (this.tracking) {
        this.rafId = null;
        return;
      }
      this.place(50 + Math.sin(now * 0.00035) * 34, 50 + Math.cos(now * 0.00052) * 32);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private stop(): void {
    if (this.rafId === null) return;
    cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }
}
