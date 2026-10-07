import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  input,
  output,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { solarBoxBoldDuotone } from '@ng-icons/solar-icons/bold-duotone';
import { DeliveryDetail } from '../../deliveries.model';
import { DeliveryRatingCard } from '../delivery-rating/delivery-rating';

@Component({
  selector: 'app-rating-prompt',
  imports: [RouterLink, NgIcon, DeliveryRatingCard],
  viewProviders: [provideIcons({ solarBoxBoldDuotone })],
  templateUrl: './rating-prompt.html',
  styleUrl: './rating-prompt.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RatingPrompt {
  readonly parcel = input.required<DeliveryDetail>();
  /** The customer waved it off. */
  readonly later = output<void>();
  /** Rated, or went to the parcel page to do it there. */
  readonly done = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal());
  }

  protected dismiss(): void {
    this.dialog().nativeElement.close();
    this.later.emit();
  }

  protected finish(): void {
    this.dialog().nativeElement.close();
    this.done.emit();
  }

  /** Escape fires `cancel`; route it through the same "Not now" path. */
  protected onCancel(event: Event): void {
    event.preventDefault();
    this.dismiss();
  }

  /** The dialog fills the viewport, so a click on its own surface is the backdrop. */
  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.dismiss();
  }
}
