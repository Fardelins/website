import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { isDevMode } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '@core/auth/auth.service';
import { MOCK_COURIERS } from '../../dev/mock-couriers';
import { emptyDraft, toInternationalPhone } from './send-delivery.model';
import { SendDeliveryService } from './send-delivery.service';

describe('SendDeliveryService', () => {
  let service: SendDeliveryService;
  let http: HttpTestingController;
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
    service = TestBed.inject(SendDeliveryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads shipment sizes from the current API route', async () => {
    const pending = service.sizes();
    const request = http.expectOne('/v1/shipment-sizes');
    expect(request.request.method).toBe('GET');
    request.flush({
      data: [
        { id: 1, name: 'A4 envelope' },
        { id: 2, name: 'Small box' },
      ],
    });

    await expect(pending).resolves.toEqual([
      { id: 1, label: 'A4 envelope' },
      { id: 2, label: 'Small box' },
    ]);
  });

  it('uploads parcel images as multipart files', async () => {
    const file = new File(['parcel'], 'parcel.png', { type: 'image/png' });
    const files = { 0: file, length: 1, item: () => file } as unknown as FileList;
    const pending = service.uploadImages(files);
    const request = http.expectOne('/v1/upload/multiple-images/shipments');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeInstanceOf(FormData);
    expect(((request.request.body as FormData).get('images') as File).name).toBe(file.name);
    request.flush([
      { id: 'ab13649a-0ac3-4597-85d7-112ee69f77a3', link: 'https://cdn.example.com/parcel.webp' },
    ]);

    await expect(pending).resolves.toEqual([
      { id: 'ab13649a-0ac3-4597-85d7-112ee69f77a3', link: 'https://cdn.example.com/parcel.webp' },
    ]);
  });

  it('sends sender details, location ids and image ids when placing an order', async () => {
    const draft = emptyDraft();
    draft.rateId = 'rate-1';
    draft.pickup = {
      ...draft.pickup,
      fullName: 'Samuel Jackson',
      phone: '+2348012345678',
      email: 'sam@example.com',
      address: '2 Wuse II, Abuja',
    };
    draft.dropoff = {
      ...draft.dropoff,
      fullName: 'Ada Obi',
      phone: '+2348098765432',
      address: '5 Allen Avenue, Ikeja',
    };
    draft.parcel.images = [{ id: 'img-1', link: 'https://cdn.example.com/a.webp' }];
    draft.parcel.sizeId = 2;

    const pending = service.order(draft, {
      pickup: { stateId: 15, cityId: 150 },
      dropoff: { stateId: 25, cityId: null },
    });
    const request = http.expectOne('/v1/customer-shipment/order/rate-1');
    const body = request.request.body as Record<string, any>;

    expect(body['sender_details']).toMatchObject({
      sender_fullname: 'Samuel Jackson',
      sender_address: '2 Wuse II, Abuja',
      sender_state_id: 15,
      sender_city_id: 150,
    });
    expect(body['receiver_details'].receiver_location).toEqual({
      address: '5 Allen Avenue, Ikeja',
      state_id: 25,
      city_id: undefined,
    });
    expect(body['parcel'].images).toEqual([{ id: 'img-1' }]);
    expect(body['shipment_size_id']).toBe(2);
    expect(body['pickup_type']).toBe('user');
    expect(body['delivery_type']).toBe('user');
    expect(body['priority']).toBe(false);
    expect(body['mode']).toBe(isDevMode() ? 'demo' : 'live');
    request.flush({
      data: {
        authorization_url: 'https://checkout.paystack.com/abc123',
        access_code: 'abc123',
        reference: 'emrn5ab4qc',
      },
    });

    await expect(pending).resolves.toEqual({
      reference: 'emrn5ab4qc',
      authorizationUrl: 'https://checkout.paystack.com/abc123',
    });
  });

  it('sends phone numbers in international format, which BE requires', async () => {
    const draft = emptyDraft();
    draft.rateId = 'rate-1';
    draft.pickup = { ...draft.pickup, phone: '0801 234 5678' };
    draft.dropoff = { ...draft.dropoff, phone: '08159876543' };

    const noIds = { stateId: null, cityId: null };
    void service.order(draft, { pickup: noIds, dropoff: noIds }).catch(() => undefined);
    const request = http.expectOne('/v1/customer-shipment/order/rate-1');
    const body = request.request.body as Record<string, any>;

    expect(body['sender_details'].sender_phone).toBe('+2348012345678');
    expect(body['receiver_details'].receiver_phone).toBe('+2348159876543');
    request.flush({ data: {} });
  });

  it('converts common Nigerian number formats and leaves international ones alone', () => {
    expect(toInternationalPhone('08159876543')).toBe('+2348159876543');
    expect(toInternationalPhone('8159876543')).toBe('+2348159876543');
    expect(toInternationalPhone('2348159876543')).toBe('+2348159876543');
    expect(toInternationalPhone('0044 7700 900123')).toBe('+447700900123');
    expect(toInternationalPhone('+1 (415) 555-0100')).toBe('+14155550100');
    expect(toInternationalPhone('12345')).toBe('12345');
  });

  it('surfaces an upload failure instead of silently discarding it', async () => {
    const file = new File(['parcel'], 'parcel.png', { type: 'image/png' });
    const files = { 0: file, length: 1, item: () => file } as unknown as FileList;
    const pending = service.uploadImages(files);
    const request = http.expectOne('/v1/upload/multiple-images/shipments');
    request.flush(
      { message: 'Image storage unavailable.' },
      { status: 502, statusText: 'Bad Gateway' },
    );

    await expect(pending).rejects.toThrow('Image storage unavailable.');
  });

  it('reads the courier name and logo from the nested courier object in a rate', async () => {
    const pending = service.rates(emptyDraft());
    // Shape from the backend's own Bruno example for POST /public/get-shipment-rates.
    http.expectOne('/v1/public/get-shipment-rates').flush([
      {
        id: 2,
        price: 800,
        delivery_duration: 2,
        hub: {
          courier_business: {
            company_name: 'Fardelins Technologies',
            uploads: [{ link: 'https://cdn.example.com/logo.webp' }],
          },
        },
      },
    ]);

    await expect(pending).resolves.toEqual([
      expect.objectContaining({
        rateId: '2',
        amount: 800,
        courierName: 'Fardelins Technologies',
        logoUrl: 'https://cdn.example.com/logo.webp',
        deliveryWindow: '2 days',
      }),
    ]);
  });

  it('reads the per-size price and nested durations from the newer rate shape', async () => {
    const draft = emptyDraft();
    draft.parcel.sizeId = 2;
    const pending = service.rates(draft);
    const size = (id: number, standard: number, available = true) => ({
      shipment_size_id: id,
      available,
      starting_price: standard,
      totals: { standard, priority: standard + 3000 },
      pickup_options: [{ type: 'user', cost: 1100 }],
      delivery_options: [
        { type: 'office', cost: 1000 },
        { type: 'user', cost: 1500 },
      ],
    });
    http.expectOne('/v1/public/get-shipment-rates').flush({
      data: [
        {
          rate_id: 8,
          hub: { courier_business: { company_name: 'Fardelins', uploads: [] } },
          durations: { standard: { pickup_duration: 1, delivery_duration: 2 } },
          sizes: [size(1, 900), size(2, 2100)],
        },
        { rate_id: 9, hub: {}, sizes: [size(2, 2500, false)] },
      ],
    });

    const rates = await pending;

    expect(rates).toHaveLength(1);
    expect(rates[0]).toMatchObject({
      rateId: '8',
      courierName: 'Fardelins',
      logoUrl: null,
      // Door pickup 1100 + door delivery 1500, what the order is charged; totals.standard (2100) assumes office delivery.
      amount: 2600,
      deliveryWindow: '2 days',
    });
  });

  describe('delivery options', () => {
    const rate = (id: number, overrides: Record<string, unknown> = {}) => ({
      rate_id: id,
      hub: { courier_business: { company_name: `Courier ${id}`, uploads: [] } },
      durations: {
        standard: { pickup_duration: 1, delivery_duration: 2 },
        priority: { pickup_duration: 1, delivery_duration: 1 },
      },
      extras: { priority: { cost: 3000 } },
      sizes: [
        {
          shipment_size_id: 2,
          available: true,
          pickup_options: [{ type: 'user', cost: 1100 }],
          delivery_options: [
            { type: 'office', cost: 1000 },
            { type: 'user', cost: 1500 },
          ],
        },
      ],
      ...overrides,
    });
    const ask = async (options: { deliveryType: 'user' | 'office'; priority: boolean }, rows: unknown[]) => {
      const draft = { ...emptyDraft(), ...options };
      draft.parcel.sizeId = 2;
      const pending = service.rates(draft);
      http.expectOne('/v1/public/get-shipment-rates').flush({ data: rows });
      return pending;
    };

    it('prices door delivery, office delivery and priority from the options sent', async () => {
      const door = await ask({ deliveryType: 'user', priority: false }, [rate(1)]);
      expect(door[0]).toMatchObject({ amount: 2600, deliveryWindow: '2 days' });

      const office = await ask({ deliveryType: 'office', priority: false }, [rate(1)]);
      expect(office[0].amount).toBe(2100);

      const priority = await ask({ deliveryType: 'user', priority: true }, [rate(1)]);
      expect(priority[0]).toMatchObject({ amount: 5600, deliveryWindow: '1 day' });
    });

    it("hides a courier that doesn't offer the chosen option", async () => {
      const noOffice = rate(2, {
        sizes: [
          {
            shipment_size_id: 2,
            available: true,
            pickup_options: [{ type: 'user', cost: 1100 }],
            delivery_options: [{ type: 'user', cost: 1500 }],
          },
        ],
      });
      const noPriority = rate(3, { extras: { priority: null } });

      const office = await ask({ deliveryType: 'office', priority: false }, [rate(1), noOffice]);
      expect(office.map((r) => r.courierName)).toEqual(['Courier 1']);

      const fast = await ask({ deliveryType: 'user', priority: true }, [rate(1), noPriority]);
      expect(fast.map((r) => r.courierName)).toEqual(['Courier 1']);
    });

    it('sends the chosen delivery type and priority with the order', async () => {
      const draft = { ...emptyDraft(), deliveryType: 'office' as const, priority: true };
      draft.rateId = 'rate-1';
      const noIds = { stateId: null, cityId: null };
      void service.order(draft, { pickup: noIds, dropoff: noIds }).catch(() => undefined);
      const request = http.expectOne('/v1/customer-shipment/order/rate-1');

      expect(request.request.body['delivery_type']).toBe('office');
      expect(request.request.body['priority']).toBe(true);
      request.flush({ data: {} });
    });
  });

  it('uses the shared demo couriers without requesting live rates for the mock account', async () => {
    mockSession = true;

    const rates = await service.rates(emptyDraft());

    expect(rates).toHaveLength(MOCK_COURIERS.length);
    expect(rates.map((rate) => rate.courierName)).toEqual(MOCK_COURIERS.map((c) => c.name));
    expect(rates.every((rate) => rate.priceLabel.startsWith('₦'))).toBe(true);
  });

  it('completes demo orders without sending a backend mutation', async () => {
    mockSession = true;

    const noIds = { stateId: null, cityId: null };
    const result = await service.order(emptyDraft(), { pickup: noIds, dropoff: noIds });
    expect(result.reference).toMatch(/^FD-DEMO-\d{8}$/);
    expect(result.authorizationUrl).toBeNull();
  });
});
