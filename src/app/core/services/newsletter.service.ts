import { Injectable } from '@angular/core';

/** Pragmatic shape check to weed out typos before a doomed POST; not RFC-exhaustive. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Newsletter subscriptions for the footer and blog card, via the Mailchimp API (proxied server-side). */
@Injectable({ providedIn: 'root' })
export class NewsletterService {
  /** Resolves true on a confirmed subscription; throws on invalid input or request failure. */
  async subscribe(email: string): Promise<boolean> {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return false;

    // Fail fast on a typo instead of waiting for the API to reject it.
    if (!isValidEmail(normalizedEmail)) throw new Error('Please enter a valid email address.');

    const response = await fetch('/api/newsletter/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail }),
    });
    if (!response.ok) throw new Error(`Newsletter request failed: ${response.status}`);

    const result = (await response.json()) as { status?: string };
    if (result.status !== 'subscribed') throw new Error('Newsletter subscription was rejected');
    return true;
  }
}
