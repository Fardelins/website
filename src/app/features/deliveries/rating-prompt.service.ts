import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { AppPromoService } from '@features/app-promo/app-promo.service';
import { parcelStatusGroup } from '@shared/parcel-status';
import { DeliveryDetail } from './deliveries.model';
import { DeliveriesService } from './deliveries.service';
import { DeliveryRatingService } from './delivery-rating.service';

const ASKED_KEY = 'fardelins.rating-prompt.asked';
const DISMISSED_KEY = 'fardelins.rating-prompt.dismissed';
/** Let the dashboard land before anything covers it. */
const SETTLE_MS = 1200;
/** Each candidate costs a rating lookup, so only the newest few are checked. */
const MAX_LOOKUPS = 3;

/** Once per sign-in session, offers to rate the newest unrated handed-over parcel; optional by design. */
@Injectable({ providedIn: 'root' })
export class RatingPromptService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly promo = inject(AppPromoService);
  private readonly deliveries = inject(DeliveriesService);
  private readonly ratings = inject(DeliveryRatingService);

  readonly parcel = signal<DeliveryDetail | null>(null);
  private checking = false;

  async check(): Promise<void> {
    const userId = this.auth.user()?.id;
    if (!this.isBrowser || !userId || this.checking || this.asked(userId)) return;
    this.checking = true;
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

    try {
      const dismissed = this.dismissed(userId);
      const candidates = (await this.deliveries.list())
        .filter(
          (item) =>
            parcelStatusGroup(item.status) === 'delivered' && !dismissed.includes(item.trackingId),
        )
        .sort((a, b) => time(b.createdAt) - time(a.createdAt))
        .slice(0, MAX_LOOKUPS);

      for (const candidate of candidates) {
        if (await this.ratings.get(candidate.trackingId)) continue;
        // Something else has the screen: leave the session unasked so the next visit tries again.
        if (!this.canInterrupt(candidate.trackingId)) return;
        this.parcel.set(await this.deliveries.detail(candidate.trackingId));
        this.markAsked(userId);
        return;
      }
      this.markAsked(userId);
    } catch {
      // The prompt is optional, so a failed lookup simply means no prompt this time.
    } finally {
      this.checking = false;
    }
  }

  /** "Not now": this parcel is never prompted again, but stays rateable from its own page. */
  later(): void {
    const parcel = this.parcel();
    const userId = this.auth.user()?.id;
    this.parcel.set(null);
    if (!parcel || !userId) return;
    this.store(DISMISSED_KEY, userId, [...this.dismissed(userId), parcel.trackingId], localStorage);
  }

  finish(): void {
    this.parcel.set(null);
  }

  private canInterrupt(trackingId: string): boolean {
    const url = this.router.url;
    return !this.promo.active() && !url.startsWith('/app/send') && !url.includes(trackingId);
  }

  private asked(userId: string): boolean {
    return this.read(ASKED_KEY, userId, sessionStorage) !== null;
  }

  private markAsked(userId: string): void {
    this.store(ASKED_KEY, userId, true, sessionStorage);
  }

  private dismissed(userId: string): string[] {
    const value = this.read(DISMISSED_KEY, userId, localStorage);
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  }

  private read(key: string, userId: string, storage: Storage): unknown {
    try {
      const raw = storage.getItem(`${key}.${userId}`);
      return raw === null ? null : JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private store(key: string, userId: string, value: unknown, storage: Storage): void {
    try {
      storage.setItem(`${key}.${userId}`, JSON.stringify(value));
    } catch {
      // Private mode or full storage: worst case the prompt asks again next session.
    }
  }
}

function time(value: string | null | undefined): number {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}
