import { Component, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ConsentService } from '@core/services/consent.service';
import { HapticsService } from '@core/services/haptics.service';

@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cookie-consent.html',
  styleUrl: './cookie-consent.css',
})
export class CookieConsent {
  private readonly consent = inject(ConsentService);
  private readonly haptics = inject(HapticsService);
  // Rendered browser-only: the choice lives in localStorage, so SSR can't know it — gating
  // here avoids a banner flash on hydration for visitors who already decided.
  protected readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly visible = this.consent.bannerVisible;
  protected readonly customizing = signal(false);
  protected readonly analyticsChoice = signal(this.consent.preferences().analytics);

  protected acceptAll(): void {
    this.haptics.light();
    this.consent.acceptAll();
    this.customizing.set(false);
  }

  protected rejectAll(): void {
    this.haptics.light();
    this.consent.rejectAll();
    this.customizing.set(false);
  }

  protected toggleCustomize(): void {
    this.haptics.selection();
    this.analyticsChoice.set(this.consent.preferences().analytics);
    this.customizing.update((open) => !open);
  }

  protected savePreferences(): void {
    this.haptics.light();
    this.consent.save({ analytics: this.analyticsChoice() });
    this.customizing.set(false);
  }
}
