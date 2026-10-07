import { Component, input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  template: '',
  styleUrl: './skeleton.css',
  host: {
    '[style.height]': 'height()',
    '[style.width]': 'width()',
    '[style.border-radius]': 'radius()',
    'aria-hidden': 'true',
  },
})
export class Skeleton {
  readonly height = input<string>('16px');
  readonly width = input<string>('100%');
  readonly radius = input<string>('8px');
}
