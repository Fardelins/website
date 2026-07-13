import { Component, inject, signal } from '@angular/core';
import { NewsletterService } from '../../services/newsletter.service';
import { HapticsService } from '../../services/haptics.service';

@Component({
  selector: 'app-blog-newsletter',
  templateUrl: './blog-newsletter.html',
  styleUrl: './blog-newsletter.css',
})
export class BlogNewsletter {
  private readonly newsletter = inject(NewsletterService);
  private readonly haptics = inject(HapticsService);
  protected readonly state = signal<'idle' | 'submitting' | 'success' | 'error'>('idle');

  protected async submit(event: SubmitEvent, email: string): Promise<void> {
    event.preventDefault();
    if (this.state() === 'submitting') return;
    if (!email.trim()) return;

    const form = event.currentTarget as HTMLFormElement;
    this.haptics.light();
    this.state.set('submitting');
    try {
      await this.newsletter.subscribe(email);
      this.state.set('success');
      form.reset();
      this.haptics.success();
    } catch {
      this.state.set('error');
      this.haptics.error();
    }
  }
}
