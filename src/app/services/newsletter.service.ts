import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { wordpressUrl } from '../config/wordpress.config';

/** WordPress Mailchimp list the site subscribes into (via the WP Rocket / CleanTalk plugin). */
const MAILCHIMP_LIST_ID = '793896f881';

/**
 * Single place that talks to WordPress's newsletter endpoint. Both the site
 * footer and the blog newsletter card subscribe through here, so there's one
 * backend integration to maintain. Posts to the same-origin `admin-ajax.php`
 * the WordPress site already exposes.
 */
@Injectable({ providedIn: 'root' })
export class NewsletterService {
  private readonly platformId = inject(PLATFORM_ID);

  /** Resolves true on a confirmed subscription; throws on network/HTTP/rejection errors. */
  async subscribe(email: string): Promise<boolean> {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return false;

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
