import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { wordpressUrl } from '@core/config/wordpress.config';

/** WordPress Mailchimp list the site subscribes into (via the WP Rocket / CleanTalk plugin). */
const MAILCHIMP_LIST_ID = '793896f881';

/** Pragmatic shape check to weed out typos before a doomed POST; not RFC-exhaustive. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Newsletter subscriptions for the footer and blog card, via WordPress admin-ajax.php. */
@Injectable({ providedIn: 'root' })
export class NewsletterService {
  private readonly platformId = inject(PLATFORM_ID);

  /** Resolves true on a confirmed subscription; throws on invalid input or request failure. */
  async subscribe(email: string): Promise<boolean> {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return false;

    // Fail fast on a typo instead of waiting for admin-ajax.php to reject it.
    if (!isValidEmail(normalizedEmail)) throw new Error('Please enter a valid email address.');

    const fields = new URLSearchParams({
      wpr_mailchimp_email: normalizedEmail,
      apbct__email_id__elementor_form: '',
    });
    const body = new URLSearchParams({
      action: 'mailchimp_subscribe',
      fields: fields.toString(),
      listId: MAILCHIMP_LIST_ID,
    });

    const response = await fetch(wordpressUrl('/wp-admin/admin-ajax.php', this.platformId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: body.toString(),
    });
    if (!response.ok) throw new Error(`Newsletter request failed: ${response.status}`);

    const result = (await response.json()) as { status?: string };
    if (result.status !== 'subscribed') throw new Error('Newsletter subscription was rejected');
    return true;
  }
}
