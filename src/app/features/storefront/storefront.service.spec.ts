import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '@core/auth/auth.service';
import { MOCK_COURIERS } from '../../dev/mock-couriers';
import { StorefrontInput } from './storefront.models';
import { StorefrontService } from './storefront.service';

describe('StorefrontService', () => {
  let mockSession: boolean;

  beforeEach(() => {
    mockSession = false;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isMockSession: () => mockSession } },
      ],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('loads and normalizes the deployed property collection', async () => {
    const service = TestBed.inject(StorefrontService);
    const http = TestBed.inject(HttpTestingController);

    const request = service.list();
    http.expectOne('/v1/user/properties').flush({
      data: [
        {
          id: 'store-1',
          name: 'Studio Store',
          email: 'store@example.com',
          phone: '+2348012345678',
          website: 'https://store.example.com',
          location: { cuid: 'location-1', address: '12 Admiralty Way' },
          preferred_courier_ids: ['courier-1'],
        },
      ],
    });

    await expect(request).resolves.toEqual([
      expect.objectContaining({
        id: 'store-1',
        name: 'Studio Store',
        preferredCourierIds: ['courier-1'],
        location: expect.objectContaining({ address: '12 Admiralty Way' }),
      }),
    ]);
  });

  it('creates a storefront with the current API field names', async () => {
    const service = TestBed.inject(StorefrontService);
    const http = TestBed.inject(HttpTestingController);
    const input: StorefrontInput = {
      name: 'Studio Store',
      email: 'store@example.com',
      phone: '+2348012345678',
      website: 'https://store.example.com',
      location: { address: '12 Admiralty Way' },
      preferred_courier_ids: ['courier-1'],
    };

    const result = service.create(input);
    const request = http.expectOne('/v1/user/property');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    request.flush({ data: { id: 'store-1', ...input } });

    await expect(result).resolves.toEqual(expect.objectContaining({ id: 'store-1' }));
  });

  it('reveals wrapped scalar keys without persisting them', async () => {
    const service = TestBed.inject(StorefrontService);
    const http = TestBed.inject(HttpTestingController);

    const result = service.revealKey('store-1');
    http.expectOne('/v1/user/view-property-key/store-1').flush({ data: 'secret-key' });

    await expect(result).resolves.toBe('secret-key');
  });

  it('uses the deployed routes for update, delete and key generation', async () => {
    const service = TestBed.inject(StorefrontService);
    const http = TestBed.inject(HttpTestingController);
    const input: StorefrontInput = {
      name: 'Studio Store',
      email: 'store@example.com',
      phone: '+2348012345678',
    };

    const update = service.update('store-1', input);
    http.expectOne('/v1/user/property/store-1').flush({ id: 'store-1', ...input });
    await update;

    const removal = service.remove('store-1');
    http.expectOne('/v1/user/property/store-1').flush({ data: 'store-1' });
    await removal;

    const generation = service.generateKey('store-1');
    http.expectOne('/v1/user/generate-property-key/store-1').flush({ code: 200 });
    await Promise.resolve();
    http.expectOne('/v1/user/view-property-key/store-1').flush({ data: 'new-key' });
    await expect(generation).resolves.toBe('new-key');
  });

  it('shares the development courier fixture with storefront preferences', async () => {
    mockSession = true;

    const couriers = await TestBed.inject(StorefrontService).preferredCouriers();

    expect(couriers.map((courier) => courier.name)).toEqual(MOCK_COURIERS.map((c) => c.name));
  });

  it("resolves Nigeria's country id and sends it as the required country_id param", async () => {
    const service = TestBed.inject(StorefrontService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.preferredCouriers();
    http.expectOne('/v1/locality/countries').flush({
      data: [
        { id: 190, name: 'nigeria' },
        { id: 161, name: 'egypt' },
      ],
    });

    const request = await vi.waitFor(() =>
      http.expectOne((req) => req.url === '/v1/user/couriers'),
    );
    expect(request.request.params.get('country_id')).toBe('190');
    expect(request.request.params.get('page')).toBe('1');
    request.flush({
      data: [
        {
          id: 'c1',
          company_name: 'Fardelins Technologies',
          status: 'active',
          logo: 'https://cdn.example.com/logo.webp',
          delivery_count: 12,
          average_delivery_rating: 4.5,
          rating_count: 8,
        },
        { id: 'c2', company_name: 'Unrated Co', logo: null, average_delivery_rating: 0 },
      ],
      total_count: 2,
      has_next_page: false,
    });

    await expect(pending).resolves.toEqual([
      expect.objectContaining({
        id: 'c1',
        name: 'Fardelins Technologies',
        logoUrl: 'https://cdn.example.com/logo.webp',
        rating: 4.5,
        reviewCount: 8,
      }),
      expect.objectContaining({ id: 'c2', name: 'Unrated Co', logoUrl: null }),
    ]);
  });
});
