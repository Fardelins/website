import { Component } from '@angular/core';
import { SendParcelCard } from '@features/dashboard/components/send-parcel-card/send-parcel-card';

/** TEMPORARY visual harness for iterating on the send card without the auth guard. Delete when done. */
@Component({
  selector: 'app-card-preview',
  imports: [SendParcelCard],
  template: `
    <div class="preview">
      <app-send-parcel-card />
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        padding: 40px;
        background: var(--dashboard-bg, #0e0e0e);
      }
      .preview {
        width: 560px;
        height: 460px;
      }
    `,
  ],
})
export class CardPreview {}
