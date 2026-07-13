import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-card',
  standalone: true,
  templateUrl: './card.html',
  styleUrl: './card.css',
})
export class Card {
  readonly image = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input<string>('');
  protected readonly imageBase = computed(() => this.image().replace(/\.(png|jpe?g)$/i, ''));
}
