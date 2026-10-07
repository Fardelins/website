import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyState } from '@shared/components/empty-state/empty-state';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarArrowRightBoldDuotone,
  solarBoxBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { DeliverySummary } from '@features/deliveries/deliveries.model';
import { StatusPill } from '@shared/components/status-pill/status-pill';

@Component({
  selector: 'app-recent-parcels',
  imports: [EmptyState, RouterLink, NgIcon, StatusPill],
  viewProviders: [provideIcons({ solarArrowRightBoldDuotone, solarBoxBoldDuotone })],
  templateUrl: './recent-parcels.html',
  styleUrl: './recent-parcels.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecentParcels {
  readonly parcels = input.required<DeliverySummary[]>();
}
