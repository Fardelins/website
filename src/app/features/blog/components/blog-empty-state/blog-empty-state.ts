import { Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { solarMagniferBoldDuotone } from '@ng-icons/solar-icons/bold-duotone';

@Component({
  selector: 'app-blog-empty-state',
  imports: [NgIcon],
  viewProviders: [provideIcons({ solarMagniferBoldDuotone })],
  templateUrl: './blog-empty-state.html',
  styleUrl: './blog-empty-state.css',
})
export class BlogEmptyState {
  readonly category = input<string>('All Articles');
  readonly query = input<string>('');
}
