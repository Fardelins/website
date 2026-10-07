import { Component, computed, input } from '@angular/core';
import { statusLabel } from '@features/tracking/tracking.model';

import { parcelStatusGroup } from '@shared/parcel-status';

@Component({
  selector: 'app-status-pill',
  templateUrl: './status-pill.html',
  styleUrl: './status-pill.css',
})
export class StatusPill {
  readonly status = input.required<string>();

  protected readonly label = computed(() => statusLabel(this.status()));
  // Unpaid is not a delivery stage, so it gets its own neutral tone instead of the pending one.
  protected readonly tone = computed(() =>
    this.status().trim().toLowerCase() === 'awaiting_payment'
      ? 'awaiting'
      : parcelStatusGroup(this.status()),
  );
}
