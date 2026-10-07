import { Location } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarAltArrowLeftBoldDuotone,
  solarDangerCircleBoldDuotone,
  solarCheckCircleBoldDuotone,
  solarEyeBoldDuotone,
  solarEyeClosedBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { HapticsService } from '@core/services/haptics.service';
import { SITE_NAME, SeoService } from '@core/services/seo.service';
import { ProfileService } from '../../profile.service';

@Component({
  selector: 'app-profile-security',
  imports: [NgIcon],
  viewProviders: [
    provideIcons({
      solarAltArrowLeftBoldDuotone,
      solarEyeBoldDuotone,
      solarEyeClosedBoldDuotone,
      solarDangerCircleBoldDuotone,
      solarCheckCircleBoldDuotone,
    }),
  ],
  templateUrl: './profile-security.html',
  styleUrls: [
    '../../../../shared/styles/forms.css',
    '../profile-edit/profile-edit.css',
    './profile-security.css',
  ],
})
export class ProfileSecurity {
  private readonly profile = inject(ProfileService);
  private readonly location = inject(Location);
  private readonly haptics = inject(HapticsService);
  private readonly seo = inject(SeoService);

  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  constructor() {
    this.seo.update({
      title: `Password & security | ${SITE_NAME}`,
      description: 'Change your Fardelins password.',
      path: '/app/profile/security',
      robots: 'noindex, nofollow',
    });
  }

  protected goBack(): void {
    this.haptics.light();
    this.location.back();
  }

  protected async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.saving()) return;

    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;

    const values = new FormData(form);
    const next = String(values.get('newPassword') ?? '');
    if (next !== String(values.get('confirmPassword') ?? '')) {
      this.error.set('Those passwords do not match.');
      this.haptics.error();
      return;
    }

    this.saving.set(true);
    this.saved.set(false);
    this.error.set(null);
    this.haptics.light();

    try {
      await this.profile.updatePassword(String(values.get('currentPassword') ?? ''), next);
      this.saved.set(true);
      this.haptics.success();
      form.reset();
    } catch (error) {
      this.error.set((error as Error).message);
      this.haptics.error();
    } finally {
      this.saving.set(false);
    }
  }

  protected setPasswordValidity(el: HTMLInputElement): void {
    if (!el.validity.tooShort) return;
    el.setCustomValidity(`Use at least ${el.minLength} characters.`);
  }
}
