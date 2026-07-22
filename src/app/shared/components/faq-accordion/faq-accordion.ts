import { Component, inject, input, signal } from '@angular/core';
import { HapticsService } from '@core/services/haptics.service';

export interface FaqItem {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-faq-accordion',
  standalone: true,
  templateUrl: './faq-accordion.html',
  styleUrl: './faq-accordion.css',
})
export class FaqAccordion {
  readonly heading = input('Frequently Asked Questions');
  readonly items = input.required<readonly FaqItem[]>();

  private readonly haptics = inject(HapticsService);
  protected readonly openIndex = signal<number | null>(null);

  protected toggle(index: number): void {
    this.openIndex.set(this.openIndex() === index ? null : index);
    this.haptics.selection();
  }
}
