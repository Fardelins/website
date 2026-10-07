import { Location } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarAltArrowLeftBoldDuotone,
  solarCameraBoldDuotone,
  solarDangerCircleBoldDuotone,
  solarCheckCircleBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { AuthService } from '@core/auth/auth.service';
import { HapticsService } from '@core/services/haptics.service';
import { SITE_NAME, SeoService } from '@core/services/seo.service';
import { ProfileService } from '../../profile.service';

@Component({
  selector: 'app-profile-edit',
  imports: [NgIcon],
  viewProviders: [
    provideIcons({
      solarAltArrowLeftBoldDuotone,
      solarCameraBoldDuotone,
      solarDangerCircleBoldDuotone,
      solarCheckCircleBoldDuotone,
    }),
  ],
  templateUrl: './profile-edit.html',
  styleUrls: ['../../../../shared/styles/forms.css', './profile-edit.css'],
})
export class ProfileEdit {
  private readonly profile = inject(ProfileService);
  private readonly auth = inject(AuthService);
  private readonly location = inject(Location);
  private readonly haptics = inject(HapticsService);
  private readonly seo = inject(SeoService);

  protected readonly user = this.auth.user;
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly saved = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly initials = computed(() => {
    const user = this.user();
    if (!user) return '';
    return (
      `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.trim() || user.email.charAt(0)
    ).toUpperCase();
  });

  constructor() {
    this.seo.update({
      title: `Edit profile | ${SITE_NAME}`,
      description: 'Update your Fardelins account details.',
      path: '/app/profile/edit',
      robots: 'noindex, nofollow',
    });
  }

  protected goBack(): void {
    this.haptics.light();
    this.location.back();
  }

  protected async onAvatar(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading.set(true);
    this.error.set(null);
    try {
      await this.profile.uploadAvatar(file);
      this.haptics.success();
    } catch (error) {
      this.error.set((error as Error).message);
      this.haptics.error();
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  protected async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (this.saving()) return;

    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;

    const values = new FormData(form);
    this.saving.set(true);
    this.saved.set(false);
    this.error.set(null);
    this.haptics.light();

    try {
      await this.profile.update({
        first_name: String(values.get('firstName') ?? '').trim(),
        last_name: String(values.get('lastName') ?? '').trim(),
        phone: String(values.get('phone') ?? '').trim() || undefined,
      });
      this.saved.set(true);
      this.haptics.success();
    } catch (error) {
      this.error.set((error as Error).message);
      this.haptics.error();
    } finally {
      this.saving.set(false);
    }
  }
}
