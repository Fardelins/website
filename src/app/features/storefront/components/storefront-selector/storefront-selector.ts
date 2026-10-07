import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { StoreAvatar } from '@shared/components/store-avatar/store-avatar';
import { Storefront } from '../../storefront.models';

@Component({
  selector: 'app-storefront-selector',
  imports: [StoreAvatar],
  templateUrl: './storefront-selector.html',
  styleUrl: './storefront-selector.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorefrontSelector {
  readonly storefronts = input.required<readonly Storefront[]>();
  readonly selectedId = input<string | null>(null);
  readonly selected = output<string>();
}
