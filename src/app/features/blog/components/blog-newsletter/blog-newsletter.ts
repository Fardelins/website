import { Component, inject, signal } from '@angular/core';
import { NewsletterService } from '@core/services/newsletter.service';
import { HapticsService } from '@core/services/haptics.service';

@Component({
  selector: 'app-blog-newsletter',
  templateUrl: './blog-newsletter.html',
  styleUrl: './blog-newsletter.css',
})
export class BlogNewsletter {
  private readonly newsletter = inject(NewsletterService);
  private readonly haptics = inject(HapticsService);
  protected readonly state = signal<
    'idle' | 'submitting' | 'success' | 'already_subscribed' | 'error'
  >('idle');
  protected readonly errorMessage = signal('');

  protected async submit(event: SubmitEvent, email: string): Promise<void> {
    event.preventDefault();
    if (this.state() === 'submitting') return;
    if (!email.trim()) return;

    const form = event.currentTarget as HTMLFormElement;
    this.haptics.light();
    this.state.set('submitting');
    try {
      const result = await this.newsletter.subscribe(email);
      this.state.set(result === 'already_subscribed' ? 'already_subscribed' : 'success');
      form.reset();
      this.haptics.success();
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Please try again.');
      this.state.set('error');
      this.haptics.error();
    }
  }
}
