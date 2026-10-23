import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { QrPlate } from '@shared/components/qr-plate/qr-plate';
import { QrGlyphs } from '@shared/utils/qr-glyphs';
import { QR_CARD_CAPTION, QrCardTheme } from './qr-card-themes';

/** The shareable profile card: who you are, a code that opens your profile, and a colour of your choice. */
@Component({
  selector: 'app-profile-qr-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [QrPlate],
  templateUrl: './profile-qr-card.html',
  styleUrl: './profile-qr-card.css',
})
export class ProfileQrCard {
  readonly theme = input.required<QrCardTheme>();
  readonly name = input.required<string>();
  readonly handle = input.required<string>();
  readonly initials = input('F');
  readonly avatarUrl = input<string | null>(null);
  readonly displayLink = input('');
  readonly glyphs = input<QrGlyphs | null>(null);

  protected readonly caption = QR_CARD_CAPTION;
  protected readonly label = computed(() => `QR code for @${this.handle()}`);
}
