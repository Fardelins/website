import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SITE_NAME, SeoService } from '@core/services/seo.service';
import { PublicProfile, PublicProfileService } from './public-profile.service';

type State = 'loading' | 'found' | 'missing' | 'failed';

/** Where a scanned QR code lands: who the code belongs to, and what to do next. */
@Component({
  selector: 'app-scanned-profile',
  imports: [RouterLink],
  templateUrl: './scanned-profile.html',
  styleUrl: './scanned-profile.css',
})
export class ScannedProfile {
  private readonly route = inject(ActivatedRoute);
  private readonly lookup = inject(PublicProfileService);
  private readonly seo = inject(SeoService);

  protected readonly username = signal('');
  protected readonly state = signal<State>('loading');
  protected readonly person = signal<PublicProfile | null>(null);
  protected readonly initials = computed(() => {
    const words = (this.person()?.name ?? '').split(/\s+/).filter(Boolean);
    return (words[0]?.[0] ?? '') + (words[1]?.[0] ?? '') || '?';
  });

  private request = 0;

  constructor() {
    // Profiles are personal, so they are never indexed or shared as search results.
    this.seo.update({
      title: `Find someone on ${SITE_NAME}`,
      description: `Open a Fardelins profile.`,
      path: '/u',
      robots: 'noindex, nofollow',
    });
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      void this.load(params.get('username') ?? '');
    });
  }

  protected retry(): void {
    void this.load(this.username());
  }

  private async load(username: string): Promise<void> {
    const request = ++this.request;
    this.username.set(username);
    this.state.set('loading');
    this.person.set(null);
    try {
      const person = await this.lookup.lookup(username);
      if (request !== this.request) return;
      this.person.set(person);
      this.state.set(person ? 'found' : 'missing');
    } catch {
      if (request === this.request) this.state.set('failed');
    }
  }
}
