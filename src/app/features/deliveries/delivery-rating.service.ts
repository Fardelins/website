import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { parseApiError } from '@core/auth/auth.models';
import { AuthService } from '@core/auth/auth.service';
import { injectLogisticsApiUrl } from '@core/services/logistics-api.config';

export interface DeliveryRating {
  score: number;
  comment: string;
}

@Injectable({ providedIn: 'root' })
export class DeliveryRatingService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = injectLogisticsApiUrl();
  private readonly auth = inject(AuthService);
  private readonly mockRatings = new Map<string, DeliveryRating>();

  /** The customer's rating for a parcel, or null when it hasn't been rated (the API answers 404). */
  async get(trackingId: string): Promise<DeliveryRating | null> {
    if (this.auth.isMockSession()) return this.mockRatings.get(trackingId) ?? null;
    try {
      return readRating(await firstValueFrom(this.http.get(this.url(trackingId))));
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) return null;
      throw new Error(parseApiError(error, "We couldn't load your rating."));
    }
  }

  async save(
    trackingId: string,
    shipmentId: string | null,
    rating: DeliveryRating,
    update: boolean,
  ): Promise<DeliveryRating> {
    if (this.auth.isMockSession()) {
      this.mockRatings.set(trackingId, rating);
      return rating;
    }
    // The DTO requires `id` without saying which; the shipment UUID is our best reading (BE to confirm).
    const body = {
      id: shipmentId ?? trackingId,
      score: rating.score,
      comment: rating.comment,
      anonymous: false,
    };
    try {
      await firstValueFrom(
        update
          ? this.http.patch(this.url(trackingId), body)
          : this.http.post(this.url(trackingId), body),
      );
      return rating;
    } catch (error) {
      throw new Error(parseApiError(error, "We couldn't send your rating. Please try again."));
    }
  }

  private url(trackingId: string): string {
    return this.apiUrl(`/shipment-rating/${encodeURIComponent(trackingId)}`);
  }
}

// No response schema in the spec, so read the obvious shapes and ignore anything without a score.
function readRating(body: unknown): DeliveryRating | null {
  const data = (body as { data?: unknown } | null)?.data ?? body;
  const record = Array.isArray(data) ? data[0] : data;
  if (!record || typeof record !== 'object') return null;
  const score = Number((record as Record<string, unknown>)['score']);
  if (!Number.isFinite(score) || score < 1) return null;
  const comment = (record as Record<string, unknown>)['comment'];
  return {
    score: Math.min(Math.round(score), 5),
    comment: typeof comment === 'string' ? comment : '',
  };
}
