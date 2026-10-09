import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { DeliveryRatingService } from './delivery-rating.service';

describe('DeliveryRatingService', () => {
  let service: DeliveryRatingService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isMockSession: () => false } },
      ],
    });
    service = TestBed.inject(DeliveryRatingService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('treats a 404 as not rated yet', async () => {
    const pending = service.get('FDL-1');
    http
      .expectOne((req) => req.url.endsWith('/v1/shipment-rating/FDL-1'))
      .flush(
        { statusCode: 404, message: 'Record not found.' },
        { status: 404, statusText: 'Not Found' },
      );
    await expect(pending).resolves.toBeNull();
  });

  it('reads score and comment from a wrapped response', async () => {
    const pending = service.get('FDL-1');
    http
      .expectOne((req) => req.url.endsWith('/v1/shipment-rating/FDL-1'))
      .flush({ data: { score: 4, comment: 'On time' } });
    await expect(pending).resolves.toEqual({ score: 4, comment: 'On time' });
  });

  it('surfaces other failures as errors', async () => {
    const pending = service.get('FDL-1');
    http
      .expectOne((req) => req.url.endsWith('/v1/shipment-rating/FDL-1'))
      .flush({ message: 'Forbidden resource' }, { status: 403, statusText: 'Forbidden' });
    await expect(pending).rejects.toThrow();
  });

  it('creates a rating keyed by the tracking code in the path, with no id in the body', async () => {
    const pending = service.save('FDL-1', { score: 5, comment: 'On time' }, false);
    const req = http.expectOne((r) => r.url.endsWith('/v1/shipment-rating/FDL-1'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ score: 5, comment: 'On time', anonymous: false });
    req.flush({ message: 'ok' });
    await expect(pending).resolves.toEqual({ score: 5, comment: 'On time' });
  });

  it('updates an existing rating with PATCH', async () => {
    const pending = service.save('FDL-1', { score: 2, comment: '' }, true);
    const req = http.expectOne((r) => r.url.endsWith('/v1/shipment-rating/FDL-1'));
    expect(req.request.method).toBe('PATCH');
    req.flush({});
    await pending;
  });
});
