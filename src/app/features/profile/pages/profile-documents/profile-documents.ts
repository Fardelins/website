import { Location } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  solarAltArrowLeftBoldDuotone,
  solarDangerCircleBoldDuotone,
  solarUploadBoldDuotone,
} from '@ng-icons/solar-icons/bold-duotone';
import { HapticsService } from '@core/services/haptics.service';
import { SITE_NAME, SeoService } from '@core/services/seo.service';
import { EmptyState } from '@shared/components/empty-state/empty-state';
import { Skeleton } from '@shared/components/skeleton/skeleton';
import { StatusPill } from '@shared/components/status-pill/status-pill';
import { ProfileService, VerificationDoc } from '../../profile.service';

const DOC_TYPES = ['NIN', 'Passport', "Driver's Licence", "Voter's Card"];
const ACCEPTED_FILE_TYPES = ['image/jpeg', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

@Component({
  selector: 'app-profile-documents',
  imports: [NgIcon, StatusPill, EmptyState, Skeleton],
  viewProviders: [
    provideIcons({
      solarAltArrowLeftBoldDuotone,
      solarUploadBoldDuotone,
      solarDangerCircleBoldDuotone,
    }),
  ],
  templateUrl: './profile-documents.html',
  styleUrls: [
    '../../../../shared/styles/forms.css',
    '../profile-edit/profile-edit.css',
    './profile-documents.css',
  ],
})
export class ProfileDocuments {
  private readonly profile = inject(ProfileService);
  private readonly location = inject(Location);
  private readonly haptics = inject(HapticsService);
  private readonly seo = inject(SeoService);

  protected readonly docTypes = DOC_TYPES;
  protected readonly docs = signal<VerificationDoc[]>([]);
  protected readonly loading = signal(true);
  protected readonly uploading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly selectedType = signal(DOC_TYPES[0]);
  protected readonly uniqueIdentifier = signal('');

  constructor() {
    this.seo.update({
      title: `Verification documents | ${SITE_NAME}`,
      description: 'Upload your identification documents.',
      path: '/app/profile/documents',
      robots: 'noindex, nofollow',
    });
    void this.load();
  }

  protected goBack(): void {
    this.haptics.light();
    this.location.back();
  }

  protected async onFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const identifier = this.uniqueIdentifier().trim();
    if (!identifier) {
      this.error.set('Enter the document number before choosing a file.');
      this.haptics.error();
      input.value = '';
      return;
    }
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      this.error.set('Choose a JPG or PDF document.');
      this.haptics.error();
      input.value = '';
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      this.error.set('Choose a document smaller than 10 MB.');
      this.haptics.error();
      input.value = '';
      return;
    }

    this.uploading.set(true);
    this.error.set(null);
    try {
      await this.profile.uploadDocument(file, this.selectedType(), identifier);
      this.uniqueIdentifier.set('');
      this.haptics.success();
      await this.load();
    } catch (error) {
      this.error.set((error as Error).message);
      this.haptics.error();
    } finally {
      this.uploading.set(false);
      input.value = '';
    }
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.docs.set(await this.profile.documents());
    this.loading.set(false);
  }
}
