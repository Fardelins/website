import { Injectable } from '@angular/core';

export type SubscribeResult = 'subscribed' | 'already_subscribed';

/** Pragmatic shape check to weed out typos before a doomed POST; not RFC-exhaustive. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Newsletter subscriptions for the footer and blog card, via the Mailchimp API (proxied server-side). */
@Injectable({ providedIn: 'root' })
export class NewsletterService {
  /** Resolves on a confirmed (or pre-existing) subscription; throws with a user-facing message otherwise. */
  async subscribe(email: string): Promise<SubscribeResult> {
    const normalizedEmail = email.trim();

    // Fail fast on a typo instead of waiting for the API to reject it.
    if (!isValidEmail(normalizedEmail)) throw new Error('Please enter a valid email address.');

    let response: Response;
    try {
      response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });
    } catch {
      throw new Error("Couldn't reach the newsletter service. Please check your connection.");
    }

    const body = (await response.json().catch(() => null)) as {
      status?: string;
      message?: string;
    } | null;

    // The server only sends a `message` for errors it wants shown verbatim
    // (bad email, rejected by Mailchimp); anything else gets a generic fallback.
    if (!response.ok) throw new Error(body?.message || 'Something went wrong. Please try again.');

    return body?.status === 'already_subscribed' ? 'already_subscribed' : 'subscribed';
  }
}
