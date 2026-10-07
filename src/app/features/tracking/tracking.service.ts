import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { firstValueFrom, timeout, type Observable } from 'rxjs';
import { logisticsApiUrl } from '@core/services/logistics-api.config';
import {
  TRACKING_PHASES,
  TrackingApiResponse,
  TrackingEvent,
  TrackingEventRaw,
  TrackingResult,
  phaseIndexForStatus,
  statusLabel,
} from './tracking.model';

// Cap the read so a slow API can't hang SSR; on timeout the caller renders the error state.
const REQUEST_TIMEOUT_MS = 8000;

/** Reads a shipment's public tracking timeline from the Fardelins logistics API. */
@Injectable({ providedIn: 'root' })
export class TrackingService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  /** Look up a shipment by tracking number. Returns null when nothing matches (404 / empty). */
  async track(trackingId: string): Promise<TrackingResult | null> {
    const id = trackingId.trim();
    if (!id) return null;

    let response: TrackingApiResponse;
    try {
      response = await this.read(
        this.http.get<TrackingApiResponse>(
          logisticsApiUrl(`/public/track-shipment/${encodeURIComponent(id)}`, this.platformId),
        ),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) return null;
      throw error;
    }

    return this.composeResult(id, response?.data ?? []);
  }

  private composeResult(id: string, raw: TrackingEventRaw[]): TrackingResult | null {
    if (raw.length === 0) return null;

    // Sort by `order` ascending, it can be non-contiguous, so never rely on
    // array position or max(order) as a step count.
    const ascending = [...raw].sort((a, b) => a.order - b.order);
    const events = ascending.map((event) => this.mapEvent(event));

    // Current phase = the furthest phase any event has reached, so an unknown
    // newest status that maps to no phase can't drag the progress bar backwards.
    const currentPhaseIndex = events.reduce((max, event) => Math.max(max, event.phaseIndex), -1);
    const latest = events[events.length - 1];

    // (pos+1)/(count+1) keeps the active phase's bar partial until it actually completes.
    const currentPhase = TRACKING_PHASES[currentPhaseIndex];
    const positionInPhase = currentPhase ? currentPhase.statuses.indexOf(latest.status) : -1;
    const currentPhaseProgress = !currentPhase
      ? 0
      : positionInPhase >= 0
        ? (positionInPhase + 1) / (currentPhase.statuses.length + 1)
        : 0.5;

    // Reaching the final phase means the parcel is delivered, the journey is
    // finished, so the last step renders as done, not as an in-progress spinner.
    const delivered = currentPhaseIndex === TRACKING_PHASES.length - 1;
    const accepted = currentPhaseIndex === 0 && latest.status === 'assigned';

    return {
      trackingId: id,
      events: [...events].reverse(),
      currentPhaseIndex,
      currentPhaseProgress,
      delivered,
      accepted,
      completed: latest.status === 'completed',
      headline: latest.statusLabel,
      updatedLabel: `${latest.dateLabel} · ${latest.timeLabel}`,
    };
  }

  private mapEvent(event: TrackingEventRaw): TrackingEvent {
    const date = new Date(event.created_at);
    const valid = !Number.isNaN(date.getTime());
    return {
      id: event.id,
      description: event.description,
      status: event.status,
      statusLabel: statusLabel(event.status),
      location: event.location,
      order: event.order,
      dateLabel: valid
        ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '',
      timeLabel: valid
        ? date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        : '',
      phaseIndex: phaseIndexForStatus(event.status),
    };
  }

  private read<T>(request$: Observable<T>): Promise<T> {
    return firstValueFrom(request$.pipe(timeout(REQUEST_TIMEOUT_MS)));
  }
}
