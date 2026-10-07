import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarArrowRightBoldDuotone,
  solarChatRoundDotsBoldDuotone,
  solarLetterBoldDuotone,
  solarPhoneCallingBoldDuotone,
  solarQuestionCircleBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { SITE_NAME, SeoService } from '@core/services/seo.service';

@Component({
  selector: 'app-help',
  imports: [RouterLink, NgIcon],
  viewProviders: [
    provideIcons({
      solarArrowRightBoldDuotone,
      solarChatRoundDotsBoldDuotone,
      solarLetterBoldDuotone,
      solarPhoneCallingBoldDuotone,
      solarQuestionCircleBoldDuotone,
    }),
  ],
  templateUrl: './help.html',
  styleUrl: './help.css',
})
export class Help {
  private readonly seo = inject(SeoService);

  constructor() {
    this.seo.update({
      title: `Help | ${SITE_NAME}`,
      description: 'Get help with your Fardelins account and deliveries.',
      path: '/app/help',
      robots: 'noindex, nofollow',
    });
  }
}
