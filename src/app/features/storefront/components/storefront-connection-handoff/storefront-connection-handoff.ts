import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarCheckCircleBoldDuotone,
  solarCopyBoldDuotone,
  solarDangerCircleBoldDuotone,
  solarEyeBoldDuotone,
  solarEyeClosedBoldDuotone,
  solarShop2BoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { Logo } from '@shared/components/logo/logo';
import { Storefront } from '../../storefront.models';

export type HandoffCopyTarget = 'property-id' | 'api-key';

@Component({
  selector: 'app-storefront-connection-handoff',
  imports: [NgIcon, Logo],
  viewProviders: [
    provideIcons({
      solarCheckCircleBoldDuotone,
      solarCopyBoldDuotone,
      solarDangerCircleBoldDuotone,
      solarEyeBoldDuotone,
      solarEyeClosedBoldDuotone,
      solarShop2BoldDuotone,
    }),
  ],
  templateUrl: './storefront-connection-handoff.html',
  styleUrls: ['../../../../shared/styles/forms.css', './storefront-connection-handoff.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorefrontConnectionHandoff {
  readonly stage = input.required<'connecting' | 'connected'>();
  readonly storefront = input<Storefront | null>(null);
  readonly apiKey = input<string | null>(null);
  readonly keyError = input<string | null>(null);
  readonly preparingKey = input(false);
  readonly courierNames = input<readonly string[]>([]);
  readonly copied = input<HandoffCopyTarget | null>(null);

  protected readonly keyVisible = signal(false);

  readonly retryKey = output<void>();
  readonly copyValue = output<{ value: string; target: HandoffCopyTarget }>();
  readonly openStorefront = output<void>();

  protected titleCase(name: string): string {
    return name.trim().replace(/(^|\s)(\S)/g, (_, space: string, first: string) => space + first.toUpperCase());
  }
}
