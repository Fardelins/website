import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

const OUTPUT_SIZE = 640;
const OUTPUT_MIME_TYPE = 'image/jpeg';
const OUTPUT_QUALITY = 0.92;
const MAX_ZOOM = 4;
const GUIDE_DIAMETER_RATIO = 0.84;

@Component({
  selector: 'app-avatar-cropper',
  templateUrl: './avatar-cropper.html',
  styleUrl: './avatar-cropper.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarCropper {
  readonly file = input.required<File>();
  readonly cancelled = output<void>();
  readonly cropped = output<File>();

  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private readonly dialog = viewChild.required<ElementRef<HTMLElement>>('dialog');
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  private objectUrl: string | null = null;
  private pointerId: number | null = null;
  private dragStart = { x: 0, y: 0, offsetX: 0, offsetY: 0 };

  protected readonly source = signal('');
  protected readonly naturalWidth = signal(0);
  protected readonly naturalHeight = signal(0);
  protected readonly cropSize = signal(320);
  protected readonly cropDiameter = computed(() => this.cropSize() * GUIDE_DIAMETER_RATIO);
  protected readonly zoom = signal(1);
  protected readonly offsetX = signal(0);
  protected readonly offsetY = signal(0);
  protected readonly exporting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly ready = computed(() => this.naturalWidth() > 0 && this.naturalHeight() > 0);
  protected readonly baseScale = computed(() =>
    Math.max(
      this.cropDiameter() / Math.max(this.naturalWidth(), 1),
      this.cropDiameter() / Math.max(this.naturalHeight(), 1),
    ),
  );
  protected readonly renderedWidth = computed(
    () => this.naturalWidth() * this.baseScale() * this.zoom(),
  );
  protected readonly renderedHeight = computed(
    () => this.naturalHeight() * this.baseScale() * this.zoom(),
  );
  protected readonly imageTransform = computed(
    () => `translate(calc(-50% + ${this.offsetX()}px), calc(-50% + ${this.offsetY()}px))`,
  );
  protected readonly zoomLabel = computed(() => `${Math.round(this.zoom() * 100)}%`);

  constructor() {
    effect(() => this.loadFile(this.file()));

    afterNextRender(() => {
      const viewport = this.viewport().nativeElement;
      const resize = new ResizeObserver(([entry]) => {
        this.cropSize.set(entry.contentRect.width);
        this.clampOffsets();
      });
      resize.observe(viewport);
      this.dialog().nativeElement.focus();

      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      this.destroyRef.onDestroy(() => {
        resize.disconnect();
        document.body.style.overflow = previousOverflow;
      });
    });

    this.destroyRef.onDestroy(() => this.releaseObjectUrl());
  }

  protected imageLoaded(event: Event): void {
    const image = event.currentTarget as HTMLImageElement;
    this.naturalWidth.set(image.naturalWidth);
    this.naturalHeight.set(image.naturalHeight);
    this.zoom.set(1);
    this.offsetX.set(0);
    this.offsetY.set(0);
    this.error.set(null);
  }

  protected imageFailed(): void {
    this.error.set("We couldn't open that image. Try another one.");
  }

  protected setZoom(value: number): void {
    this.zoom.set(Math.min(MAX_ZOOM, Math.max(1, value)));
    this.clampOffsets();
  }

  protected onWheel(event: WheelEvent): void {
    event.preventDefault();
    this.setZoom(this.zoom() + (event.deltaY < 0 ? 0.12 : -0.12));
  }

  protected startDrag(event: PointerEvent): void {
    if (!this.ready()) return;
    this.pointerId = event.pointerId;
    this.dragStart = {
      x: event.clientX,
      y: event.clientY,
      offsetX: this.offsetX(),
      offsetY: this.offsetY(),
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  protected drag(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) return;
    this.offsetX.set(this.dragStart.offsetX + event.clientX - this.dragStart.x);
    this.offsetY.set(this.dragStart.offsetY + event.clientY - this.dragStart.y);
    this.clampOffsets();
  }

  protected endDrag(event: PointerEvent): void {
    if (this.pointerId !== event.pointerId) return;
    this.pointerId = null;
  }

  protected nudge(event: KeyboardEvent): void {
    const amount = event.shiftKey ? 18 : 6;
    const movement: Record<string, [number, number]> = {
      ArrowLeft: [-amount, 0],
      ArrowRight: [amount, 0],
      ArrowUp: [0, -amount],
      ArrowDown: [0, amount],
    };
    const delta = movement[event.key];
    if (!delta) return;
    event.preventDefault();
    this.offsetX.update((value) => value + delta[0]);
    this.offsetY.update((value) => value + delta[1]);
    this.clampOffsets();
  }

  protected async usePhoto(): Promise<void> {
    if (!this.ready() || this.exporting()) return;
    this.exporting.set(true);
    this.error.set(null);
    try {
      const image = this.viewport().nativeElement.querySelector('img');
      if (!image) throw new Error('Image unavailable');
      const scale = this.baseScale() * this.zoom();
      const sourceSize = this.cropDiameter() / scale;
      const sourceX = this.naturalWidth() / 2 - sourceSize / 2 - this.offsetX() / scale;
      const sourceY = this.naturalHeight() / 2 - sourceSize / 2 - this.offsetY() / scale;
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        OUTPUT_SIZE,
        OUTPUT_SIZE,
      );
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, OUTPUT_MIME_TYPE, OUTPUT_QUALITY),
      );
      if (!blob) throw new Error('Export failed');
      const stem = this.file().name.replace(/\.[^.]+$/, '') || 'avatar';
      this.cropped.emit(new File([blob], `${stem}.jpg`, { type: OUTPUT_MIME_TYPE }));
    } catch {
      this.error.set("We couldn't prepare that crop. Please try again.");
    } finally {
      this.exporting.set(false);
    }
  }

  protected cancel(): void {
    this.cancelled.emit();
  }

  protected backdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.cancel();
  }

  private loadFile(file: File): void {
    if (!this.isBrowser) return;
    this.releaseObjectUrl();
    this.naturalWidth.set(0);
    this.naturalHeight.set(0);
    this.objectUrl = URL.createObjectURL(file);
    this.source.set(this.objectUrl);
  }

  private clampOffsets(): void {
    const maxX = Math.max(0, (this.renderedWidth() - this.cropDiameter()) / 2);
    const maxY = Math.max(0, (this.renderedHeight() - this.cropDiameter()) / 2);
    this.offsetX.update((value) => Math.min(maxX, Math.max(-maxX, value)));
    this.offsetY.update((value) => Math.min(maxY, Math.max(-maxY, value)));
  }

  private releaseObjectUrl(): void {
    if (!this.objectUrl) return;
    URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }
}
