import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { CountUpDirective } from '@shared/directives/count-up.directive';
import {
  solarArrowRightDownBoldDuotone,
  solarArrowRightUpBoldDuotone,
  solarBoxBoldDuotone,
  solarDeliveryBoldDuotone,
  solarEyeBoldDuotone,
  solarEyeClosedBoldDuotone,
  solarVerifiedCheckBoldDuotone,
  solarWalletBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { DashboardMetric } from '../../dashboard.models';

@Component({
  selector: 'app-parcel-snapshot-card',
  imports: [NgIcon, CountUpDirective],
  viewProviders: [
    provideIcons({
      solarArrowRightDownBoldDuotone,
      solarArrowRightUpBoldDuotone,
      solarBoxBoldDuotone,
      solarDeliveryBoldDuotone,
      solarEyeBoldDuotone,
      solarEyeClosedBoldDuotone,
      solarVerifiedCheckBoldDuotone,
      solarWalletBoldDuotone,
    }),
  ],
  templateUrl: './parcel-snapshot-card.html',
  styleUrl: './parcel-snapshot-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ParcelSnapshotCard {
  readonly metric = input.required<DashboardMetric>();
  readonly spendVisible = input(true);
  readonly spendVisibleChange = output<boolean>();

  protected readonly segments = computed(() => {
    let start = 0;
    return (this.metric().breakdown?.segments ?? []).map((segment) => {
      const result = { ...segment, delay: start * 9, duration: Math.max(segment.percent * 9, 1) };
      start += segment.percent;
      return result;
    });
  });
  protected readonly animationKey = computed(() => JSON.stringify(this.metric().breakdown));

  /** Splits "₦12,500" into the bits either side of the number so the counter can animate it. */
  protected readonly parts = computed(() => {
    const display = this.metric().displayValue;
    const match = /\d[\d.,\s]*/.exec(display);
    if (!match) return { prefix: '', suffix: '', decimals: 0 };
    const digits = match[0].trimEnd();
    return {
      prefix: display.slice(0, match.index),
      suffix: display.slice(match.index + digits.length),
      decimals: (digits.split('.')[1] ?? '').length,
    };
  });
}
