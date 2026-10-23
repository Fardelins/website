import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TrackingService } from './tracking.service';

describe('TrackingService', () => {
  let service: TrackingService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TrackingService);
    http = TestBed.inject(HttpTestingController);
  });

  it('treats a parcel with no events yet as found, still waiting on a dispatcher', async () => {
    const pending = service.track('FDL-1');
    http
      .expectOne((req) => req.url.endsWith('/v1/public/track-shipment/FDL-1'))
      .flush({ message: 'Shipment_Tracking fetched sucessfully.', code: 200, data: [] });

    const result = await pending;
    expect(result).toMatchObject({
      trackingId: 'FDL-1',
      events: [],
      currentPhaseIndex: 0,
      delivered: false,
      accepted: false,
      headline: 'Pending',
    });
  });

  it('reads events from data.tracking and the payment status beside them', async () => {
    const pending = service.track('FDL-3');
    http
      .expectOne((req) => req.url.endsWith('/v1/public/track-shipment/FDL-3'))
      .flush({
        data: {
          transaction_status: 'success',
          tracking: [
            {
              id: 'a',
              description: 'Order placed',
              status: 'pending',
              location: null,
              order: 1,
              created_at: '2026-10-09T09:00:00Z',
            },
          ],
        },
      });

    const result = await pending;
    expect(result?.events).toHaveLength(1);
    expect(result?.paymentStatus).toBe('success');
  });

  it.each([
    [null, null],
    ['canceled', 'canceled'],
    ['refunded', 'unknown'],
  ])('maps transaction_status %s to %s without crashing', async (status, expected) => {
    const pending = service.track('FDL-4');
    http
      .expectOne((req) => req.url.endsWith('/v1/public/track-shipment/FDL-4'))
      .flush({ data: { transaction_status: status, tracking: [] } });

    const result = await pending;
    expect(result?.paymentStatus).toBe(expected);
    expect(result?.headline).toBe('Pending');
  });

  it('still reports an unknown tracking number as not found', async () => {
    const pending = service.track('FDL-0');
    http
      .expectOne((req) => req.url.endsWith('/v1/public/track-shipment/FDL-0'))
      .flush({ message: 'Not Found', statusCode: 404 }, { status: 404, statusText: 'Not Found' });

    await expect(pending).resolves.toBeNull();
  });

  it('orders events by their order field and reads the furthest phase reached', async () => {
    const pending = service.track('FDL-2');
    http
      .expectOne((req) => req.url.endsWith('/v1/public/track-shipment/FDL-2'))
      .flush({
        data: [
          {
            id: 'b',
            description: 'Assigned',
            status: 'assigned',
            location: null,
            order: 4,
            created_at: '2026-10-09T10:00:00Z',
          },
          {
            id: 'a',
            description: 'Order placed',
            status: 'pending',
            location: null,
            order: 2,
            created_at: '2026-10-09T09:00:00Z',
          },
        ],
      });

    const result = await pending;
    expect(result?.events.map((event) => event.id)).toEqual(['b', 'a']);
    expect(result?.accepted).toBe(true);
  });
});
