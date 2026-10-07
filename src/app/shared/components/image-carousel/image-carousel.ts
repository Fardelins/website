import { Component, ElementRef, computed, input, signal, viewChild } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarAltArrowLeftBoldDuotone,
  solarAltArrowRightBoldDuotone,
  solarCloseCircleBoldDuotone,
  solarGalleryBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';

@Component({
  selector: 'app-image-carousel',
  imports: [NgIcon],
  viewProviders: [
    provideIcons({
      solarAltArrowLeftBoldDuotone,
      solarAltArrowRightBoldDuotone,
      solarCloseCircleBoldDuotone,
      solarGalleryBoldDuotone,
    }),
  ],
  templateUrl: './image-carousel.html',
  styleUrl: './image-carousel.css',
})
export class ImageCarousel {
  readonly images = input.required<string[]>();
  readonly label = input('Parcel photo');

  protected readonly index = signal(0);
  protected readonly many = computed(() => this.images().length > 1);
  protected readonly current = computed(() => {
    const images = this.images();
    return images[Math.min(this.index(), Math.max(images.length - 1, 0))] ?? null;
  });
  private readonly lightbox = viewChild<ElementRef<HTMLDialogElement>>('lightbox');

  protected select(position: number): void {
    this.index.set(position);
  }

  protected step(direction: 1 | -1): void {
    const total = this.images().length;
    if (total < 2) return;
    this.index.update((value) => (value + direction + total) % total);
  }

  protected open(): void {
    if (this.current()) this.lightbox()?.nativeElement.showModal();
  }

  protected close(): void {
    this.lightbox()?.nativeElement.close();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') this.step(1);
    else if (event.key === 'ArrowLeft') this.step(-1);
  }

  /** The dialog fills the viewport, so a click on its own surface (not the image or buttons) is the backdrop. */
  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }
}
