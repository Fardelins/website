import { Component, input } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarDangerCircleBoldDuotone,
  solarInboxBoldDuotone,
  solarBoxMinimalisticBoldDuotone,
  solarMapPointWaveBoldDuotone,
  solarMinimalisticMagniferBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';

@Component({
  selector: 'app-empty-state',
  imports: [NgIcon],
  viewProviders: [
    provideIcons({
      solarBoxMinimalisticBoldDuotone,
      solarInboxBoldDuotone,
      solarMinimalisticMagniferBoldDuotone,
      solarDangerCircleBoldDuotone,
      solarMapPointWaveBoldDuotone,
    }),
  ],
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.css',
})
export class EmptyState {
  readonly icon = input<string>('solarBoxMinimalisticBoldDuotone');
  readonly title = input.required<string>();
  readonly copy = input<string>('');
  readonly tone = input<'default' | 'error'>('default');
}
