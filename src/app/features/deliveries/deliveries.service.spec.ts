import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '@core/auth/auth.service';
import type { AuthUser } from '@core/auth/auth.models';
import { filterMockDeliveries } from './deliveries.mock';
import { DeliverySummary, EMPTY_PARCEL_FILTERS, ParcelFilters } from './deliveries.model';
import { DeliveriesService } from './deliveries.service';

const isShipments = (req: { url: string }) => req.url === '/v1/customer-shipment/shipments';

describe('DeliveriesService account cache', () => {
  const user = signal<AuthUser | null>(account('account-a'));

  beforeEach(() => {
    user.set(account('account-a'));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            user: user.asReadonly(),
            isMockSession: () => false,
          },
        },
      ],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('reuses parcel data only while the same account owns the session', async () => {
    const service = TestBed.inject(DeliveriesService);
    const http = TestBed.inject(HttpTestingController);

    const first = service.list();
    http.expectOne(isShipments).flush(shipment('Parcel A'));
    await expect(first).resolves.toEqual([expect.objectContaining({ title: 'Parcel A' })]);

    await expect(service.list()).resolves.toEqual([expect.objectContaining({ title: 'Parcel A' })]);
    http.expectNone(isShipments);

    user.set(account('account-b'));
    const second = service.list();
    http.expectOne(isShipments).flush(shipment('Parcel B'));
    await expect(second).resolves.toEqual([expect.objectContaining({ title: 'Parcel B' })]);
  });

  // Trimmed from a real GET /customer-shipment/shipments row on dev (2026-10-05).
  const realRow = {
    id: '11bc05aa-e311-49c5-87e1-20ebcbc01010',
    tracking_id: 'FDL-7546635114884',
    receiver_fullname: 'Williams Ojiofor',
    status: 'pending',
    created_at: '2026-10-05T23:20:14.913Z',
    order: { amount: 2600, status: 'paid' },
    tracking: [],
    receiver_location: {
      address: 'Wuse, Abuja, Nigeria',
      latitude: 9.0752322,
      longitude: 7.4767315,
    },
    sender_location: { address: 'Abuja, Nigeria', latitude: 9.0562646, longitude: 7.4985259 },
    parcels: [{ short_description: 'Pixel 3', weight: 2.75, media: [] }],
    hub: { courier_business: { company_name: 'Fardelins', currency: { code: 'NGN' } } },
    total_weight: 2.75,
  };

  it('reads the title, amount and currency from the real list row shape', async () => {
    const service = TestBed.inject(DeliveriesService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.list();
    http.expectOne(isShipments).flush({ data: [realRow], has_next_page: false });

    await expect(pending).resolves.toEqual([
      expect.objectContaining({
        trackingId: 'FDL-7546635114884',
        title: 'Pixel 3',
        dropOff: 'Wuse, Abuja, Nigeria',
        amount: 2600,
        currency: 'NGN',
        receiverName: 'Williams Ojiofor',
      }),
    ]);
  });

  it("builds the detail from the customer's own list row, not the courier-only endpoint", async () => {
    const service = TestBed.inject(DeliveriesService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.detail('FDL-7546635114884');
    const request = http.expectOne(isShipments);
    expect(request.request.params.has('tracking_id')).toBe(false);
    expect(request.request.params.get('search')).toBe('FDL-7546635114884');
    request.flush({ data: [realRow], has_next_page: false });

    await expect(pending).resolves.toEqual(
      expect.objectContaining({
        pickupAddress: 'Abuja, Nigeria',
        dropOffAddress: 'Wuse, Abuja, Nigeria',
        courierName: 'Fardelins',
        weightLabel: '2.75kg',
        paid: true,
        pickupCoords: { lat: 9.0562646, lon: 7.4985259 },
        dropOffCoords: { lat: 9.0752322, lon: 7.4767315 },
      }),
    );
  });

  it('places a completed parcel on the last step even with no tracking events', async () => {
    const service = TestBed.inject(DeliveriesService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.detail('FDL-7546635114884');
    http
      .expectOne(isShipments)
      .flush({ data: [{ ...realRow, status: 'completed', tracking: [] }], has_next_page: false });

    await expect(pending).resolves.toEqual(expect.objectContaining({ currentPhaseIndex: 3 }));
  });

  it('drops parcels outside the chosen state and city, since BE returns them all', async () => {
    const service = TestBed.inject(DeliveriesService);
    const http = TestBed.inject(HttpTestingController);
    const row = (id: string, state: string, city: string) => ({
      id,
      tracking_id: `FDL-${id}`,
      status: 'pending',
      receiver_location: { address: 'x', state: { name: state }, city: { name: city } },
      order: { id: `o${id}`, status: 'paid', amount: 100 },
    });
    const rows = [
      row('1', 'abuja', 'durumi'),
      row('2', 'abuja', 'wuse'),
      row('3', 'lagos', 'ikeja'),
    ];
    const ask = async (state: string, city = '') => {
      const pending = service.search({ ...EMPTY_PARCEL_FILTERS, state, city });
      http.expectOne(isShipments).flush({ data: rows, has_next_page: false });
      return (await pending).map((item) => item.trackingId);
    };

    expect(await ask('abuja')).toEqual(['FDL-1', 'FDL-2']);
    expect(await ask('Abuja', 'durumi')).toEqual(['FDL-1']);
    expect(await ask('kano')).toEqual([]);
  });

  describe('invoice', () => {
    const invoiceUrl = '/v1/customer-shipment/invoice/FDL-1';

    it('fetches the PDF as a file and reuses the name BE gives it', async () => {
      const service = TestBed.inject(DeliveriesService);
      const http = TestBed.inject(HttpTestingController);

      const pending = service.invoice('FDL-1');
      const request = http.expectOne(invoiceUrl);
      expect(request.request.method).toBe('GET');
      expect(request.request.responseType).toBe('blob');
      request.flush(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), {
        headers: { 'Content-Disposition': 'attachment; filename="invoice-FDL-1.pdf"' },
      });

      const { blob, filename } = await pending;
      expect(filename).toBe('invoice-FDL-1.pdf');
      expect(blob.type).toBe('application/pdf');
    });

    it('names the file itself when BE sends no name', async () => {
      const service = TestBed.inject(DeliveriesService);
      const http = TestBed.inject(HttpTestingController);

      const pending = service.invoice('FDL-1');
      http.expectOne(invoiceUrl).flush(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));

      expect((await pending).filename).toBe('invoice-FDL-1.pdf');
    });

    it('says the invoice was not found for the 400 BE uses for that', async () => {
      const service = TestBed.inject(DeliveriesService);
      const http = TestBed.inject(HttpTestingController);

      const pending = service.invoice('FDL-1');
      http.expectOne(invoiceUrl).flush(
        new Blob([JSON.stringify({ message: 'shipment not found' })], {
          type: 'application/json',
        }),
        { status: 400, statusText: 'Bad Request' },
      );

      await expect(pending).rejects.toThrow("couldn't find an invoice");
    });

    it('says the invoice could not be generated when BE fails to build the PDF', async () => {
      const service = TestBed.inject(DeliveriesService);
      const http = TestBed.inject(HttpTestingController);

      const pending = service.invoice('FDL-1');
      http.expectOne(invoiceUrl).flush(
        new Blob(
          [
            JSON.stringify({
              message: 'Failed to launch the browser process: Running as root without --no-sandbox',
            }),
          ],
          { type: 'application/json' },
        ),
        { status: 400, statusText: 'Bad Request' },
      );

      await expect(pending).rejects.toThrow("couldn't be generated");
    });

    it('asks to try again for any other failure', async () => {
      const service = TestBed.inject(DeliveriesService);
      const http = TestBed.inject(HttpTestingController);

      const pending = service.invoice('FDL-1');
      http.expectOne(invoiceUrl).flush(new Blob([]), { status: 500, statusText: 'Server Error' });

      await expect(pending).rejects.toThrow('try again');
    });
  });

  it('returns null when the tracking id is not in the account list', async () => {
    const service = TestBed.inject(DeliveriesService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.detail('FDL-unknown');
    http.expectOne(isShipments).flush({ data: [], has_next_page: false });
    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne(isShipments).flush({ data: [realRow], has_next_page: false });

    await expect(pending).resolves.toBeNull();
  });

  it('scans the whole list when the search finds nothing', async () => {
    const service = TestBed.inject(DeliveriesService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.detail('FDL-7546635114884');
    http.expectOne(isShipments).flush({ data: [], has_next_page: false });
    await new Promise((resolve) => setTimeout(resolve));
    const scan = http.expectOne(isShipments);
    expect(scan.request.params.has('search')).toBe(false);
    scan.flush({ data: [realRow], has_next_page: false });

    await expect(pending).resolves.toEqual(expect.objectContaining({ courierName: 'Fardelins' }));
  });

  it('shows an unpaid shipment as awaiting payment, not as a pending parcel', async () => {
    const service = TestBed.inject(DeliveriesService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.list();
    http.expectOne(isShipments).flush({
      data: [
        { ...realRow, tracking_id: 'FDL-A', order: { amount: 2600, status: 'pending' } },
        { ...realRow, tracking_id: 'FDL-B', order: { amount: 2600, status: 'paid' } },
        { ...realRow, tracking_id: 'FDL-C', status: 'canceled', order: { status: 'pending' } },
      ],
      has_next_page: false,
    });

    const rows = await pending;
    expect(rows.map((row) => row.status)).toEqual(['awaiting_payment', 'pending', 'canceled']);
  });

  it('reads photos, package facts, contacts and delivery type for the detail page', async () => {
    const service = TestBed.inject(DeliveriesService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.detail('FDL-7546635114884');
    http.expectOne(isShipments).flush({
      data: [
        {
          ...realRow,
          delivery_type: 'office',
          sender_phone: '+2348012345678',
          receiver_email: 'r@example.com',
          parcels: [
            {
              short_description: 'Pixel 3',
              long_description: 'Boxed, with charger',
              type: 'non_perishable',
              quantity: 2,
              worth: 50000,
              dimension: { length: 25, width: 20, height: 15 },
              category: { name: 'Electronics' },
              media: [
                { id: 'a', link: 'https://cdn.example.com/a.webp' },
                { id: 'b', link: 'https://cdn.example.com/b.webp' },
              ],
            },
          ],
          hub: {
            courier_business: {
              company_name: 'Fardelins',
              helpline: '+2348000000000',
              contact_email: 'help@fardelins.io',
              currency: { code: 'NGN' },
              owner: { email: 'owner@example.com', phone: '+2348111111111' },
            },
          },
        },
      ],
      has_next_page: false,
    });

    const detail = await pending;
    expect(detail).toEqual(
      expect.objectContaining({
        images: ['https://cdn.example.com/a.webp', 'https://cdn.example.com/b.webp'],
        description: 'Boxed, with charger',
        categoryLabel: 'Electronics',
        parcelTypeLabel: 'Non-perishable',
        dimensionsLabel: '25 × 20 × 15 cm',
        quantity: 2,
        deliveryTypeLabel: 'Courier office',
        senderPhone: '+2348012345678',
        receiverEmail: 'r@example.com',
        courierContact: '+2348000000000 · help@fardelins.io',
      }),
    );
    expect(JSON.stringify(detail)).not.toContain('owner@example.com');
  });

  describe('cancel', () => {
    const cancelUrl = '/v1/user/shipment/da2e356c';
    const settle = () => new Promise((resolve) => setTimeout(resolve));

    it('patches the shipment id with the canceled status and refreshes the list', async () => {
      const service = TestBed.inject(DeliveriesService);
      const http = TestBed.inject(HttpTestingController);

      const pending = service.cancel('da2e356c');
      const request = http.expectOne(cancelUrl);
      expect(request.request.method).toBe('PATCH');
      expect(request.request.body).toEqual({ status: 'canceled' });
      request.flush({}, { status: 202, statusText: 'Accepted' });
      await settle();
      http.expectOne(isShipments).flush({ data: [], has_next_page: false });

      await expect(pending).resolves.toBeUndefined();
    });

    it('counts a 400 as cancelled when the list shows the change was applied', async () => {
      const service = TestBed.inject(DeliveriesService);
      const http = TestBed.inject(HttpTestingController);

      const pending = service.cancel('da2e356c');
      http
        .expectOne(cancelUrl)
        .flush({ message: 'Something went wrong' }, { status: 400, statusText: 'Bad Request' });
      await settle();
      http
        .expectOne(isShipments)
        .flush({ data: [{ id: 'da2e356c', status: 'canceled' }], has_next_page: false });
      await settle();
      http.expectOne(isShipments).flush({ data: [], has_next_page: false });

      await expect(pending).resolves.toBeUndefined();
    });

    it('treats 409 (already cancelled) as done', async () => {
      const service = TestBed.inject(DeliveriesService);
      const http = TestBed.inject(HttpTestingController);

      const pending = service.cancel('da2e356c');
      http
        .expectOne(cancelUrl)
        .flush({ message: 'status already updated' }, { status: 409, statusText: 'Conflict' });
      await settle();
      http.expectOne(isShipments).flush({ data: [], has_next_page: false });

      await expect(pending).resolves.toBeUndefined();
    });

    it('fails when the request fails and the shipment is still not cancelled', async () => {
      const service = TestBed.inject(DeliveriesService);
      const http = TestBed.inject(HttpTestingController);

      const pending = service.cancel('da2e356c');
      http
        .expectOne(cancelUrl)
        .flush({ message: 'nope' }, { status: 500, statusText: 'Server Error' });
      await settle();
      http
        .expectOne(isShipments)
        .flush({ data: [{ id: 'da2e356c', status: 'pending' }], has_next_page: false });

      await expect(pending).rejects.toThrow("We couldn't cancel this shipment");
    });
  });

  it('exposes the shipment and order ids needed to cancel or pay', async () => {
    const service = TestBed.inject(DeliveriesService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.list();
    http.expectOne(isShipments).flush({
      data: [
        { ...realRow, id: 'ship-1', order: { id: 'order-1', amount: 2600, status: 'pending' } },
      ],
      has_next_page: false,
    });

    await expect(pending).resolves.toEqual([
      expect.objectContaining({ shipmentId: 'ship-1', orderId: 'order-1' }),
    ]);
  });

  it('labels door delivery "Your doorstep" and keeps the date a shipment last changed', async () => {
    const service = TestBed.inject(DeliveriesService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.detail('FDL-7546635114884');
    http.expectOne(isShipments).flush({
      data: [{ ...realRow, delivery_type: 'user', updated_at: '2026-10-06T19:16:00Z' }],
      has_next_page: false,
    });

    const detail = await pending;
    expect(detail?.deliveryTypeLabel).toBe('Your doorstep');
    expect(detail?.updatedLabel).toBeTruthy();
  });

  it("uses the image's link from the parcel media list", async () => {
    const service = TestBed.inject(DeliveriesService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.list();
    const row = {
      ...realRow,
      parcels: [
        {
          short_description: 'Pixel 3',
          media: [{ id: 'm1', link: 'https://cdn.example.com/a.webp' }],
        },
      ],
    };
    http.expectOne(isShipments).flush({ data: [row], has_next_page: false });

    await expect(pending).resolves.toEqual([
      expect.objectContaining({ imageUrl: 'https://cdn.example.com/a.webp' }),
    ]);
  });

  it('keeps the new account cache when an old request finishes late', async () => {
    const service = TestBed.inject(DeliveriesService);
    const http = TestBed.inject(HttpTestingController);

    const oldAccount = service.list();
    user.set(account('account-b'));
    const newAccount = service.list();
    const requests = http.match(isShipments);

    requests[1].flush(shipment('Parcel B'));
    requests[0].flush(shipment('Parcel A'));

    await expect(newAccount).resolves.toEqual([expect.objectContaining({ title: 'Parcel B' })]);
    await expect(oldAccount).resolves.toEqual([expect.objectContaining({ title: 'Parcel A' })]);
    await expect(service.list()).resolves.toEqual([expect.objectContaining({ title: 'Parcel B' })]);
    http.expectNone(isShipments);
  });

  it('asks for an explicit page and limit instead of relying on the default page', async () => {
    const service = TestBed.inject(DeliveriesService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.list();
    const request = http.expectOne(isShipments);

    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('limit')).toBe('20');
    request.flush({ data: [], has_next_page: false });
    await expect(pending).resolves.toEqual([]);
  });

  it('fetches every page, using total_pages when has_next_page is not sent', async () => {
    const service = TestBed.inject(DeliveriesService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.list();
    const first = http.expectOne(isShipments);
    expect(first.request.params.get('page')).toBe('1');
    first.flush({ ...shipment('Parcel A'), page: 1, total_pages: 2 });

    await vi.waitFor(() => {
      const second = http.expectOne(isShipments);
      expect(second.request.params.get('page')).toBe('2');
      second.flush({ ...shipment('Parcel B'), page: 2, total_pages: 2 });
    });

    await expect(pending).resolves.toEqual([
      expect.objectContaining({ title: 'Parcel A' }),
      expect.objectContaining({ title: 'Parcel B' }),
    ]);
  });

  it('keeps the filters on every page of a filtered search', async () => {
    const service = TestBed.inject(DeliveriesService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.search({ ...EMPTY_PARCEL_FILTERS, minPrice: 5000 });
    http
      .expectOne(isShipments)
      .flush({ ...shipment('Parcel A'), pagination: { has_next_page: true } });

    await vi.waitFor(() => {
      const second = http.expectOne(isShipments);
      expect(second.request.params.get('min_price')).toBe('5000');
      expect(second.request.params.get('page')).toBe('2');
      second.flush({ ...shipment('Parcel B'), pagination: { has_next_page: false } });
    });

    await expect(pending).resolves.toHaveLength(2);
  });

  it('sends every advanced filter as the query params the API documents', async () => {
    const service = TestBed.inject(DeliveriesService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.search({
      dateFrom: '2026-09-01',
      dateTo: '2026-09-30',
      minPrice: 5000,
      maxPrice: 15000,
      state: 'lagos',
      city: 'ikeja',
    });
    const request = http.expectOne((req) => req.url === '/v1/customer-shipment/shipments');

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('date_from')).toBe('2026-09-01');
    expect(request.request.params.get('date_to')).toBe('2026-09-30');
    expect(request.request.params.get('min_price')).toBe('5000');
    expect(request.request.params.get('max_price')).toBe('15000');
    expect(request.request.params.get('location[country]')).toBe('nigeria');
    expect(request.request.params.get('location[state]')).toBe('lagos');
    expect(request.request.params.get('location[city]')).toBe('ikeja');
    request.flush(shipment('Parcel A'));

    await expect(pending).resolves.toEqual([expect.objectContaining({ title: 'Parcel A' })]);
  });

  it('omits unset filters, and never sends a city without a state', async () => {
    const service = TestBed.inject(DeliveriesService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.search({ ...EMPTY_PARCEL_FILTERS, city: 'ikeja', minPrice: 0 });
    const request = http.expectOne((req) => req.url === '/v1/customer-shipment/shipments');

    expect(request.request.params.keys()).toEqual(['min_price', 'page', 'limit']);
    expect(request.request.params.get('min_price')).toBe('0');
    request.flush({ data: [] });
    await expect(pending).resolves.toEqual([]);
  });

  it('does not touch the shared unfiltered list cache when searching', async () => {
    const service = TestBed.inject(DeliveriesService);
    const http = TestBed.inject(HttpTestingController);

    const filtered = service.search({ ...EMPTY_PARCEL_FILTERS, maxPrice: 100 });
    http
      .expectOne((req) => req.url === '/v1/customer-shipment/shipments')
      .flush(shipment('Parcel A'));
    await filtered;

    const list = service.list();
    http.expectOne(isShipments).flush(shipment('Parcel B'));
    await expect(list).resolves.toEqual([expect.objectContaining({ title: 'Parcel B' })]);
  });
});

describe('filterMockDeliveries', () => {
  const items = [
    mock('A', {
      createdAt: '2026-09-05T10:00:00.000Z',
      amount: 3000,
      dropOff: '1 Bode St, Lekki, Lagos',
    }),
    mock('B', { createdAt: '2026-09-20T10:00:00.000Z', amount: 9000, dropOff: '5 Wuse II, Abuja' }),
    mock('C', { createdAt: null, amount: null, dropOff: null }),
  ];
  const names = (filters: Partial<ParcelFilters>) =>
    filterMockDeliveries(items, { ...EMPTY_PARCEL_FILTERS, ...filters }).map((i) => i.title);

  it('returns everything when no filter is set', () => {
    expect(names({})).toEqual(['A', 'B', 'C']);
  });

  it('treats the date range as inclusive of both ends', () => {
    expect(names({ dateFrom: '2026-09-05', dateTo: '2026-09-20' })).toEqual(['A', 'B']);
    expect(names({ dateFrom: '2026-09-06' })).toEqual(['B']);
  });

  it('filters by amount, treating a missing amount as 0', () => {
    expect(names({ minPrice: 4000 })).toEqual(['B']);
    expect(names({ maxPrice: 3000 })).toEqual(['A', 'C']);
  });

  it('matches state and city against the drop-off address, ignoring case', () => {
    expect(names({ state: 'lagos' })).toEqual(['A']);
    expect(names({ state: 'lagos', city: 'LEKKI' })).toEqual(['A']);
    expect(names({ state: 'lagos', city: 'ikeja' })).toEqual([]);
  });
});

function mock(title: string, extra: Partial<DeliverySummary>): DeliverySummary {
  return {
    trackingId: title,
    title,
    status: 'pending',
    imageUrl: null,
    createdLabel: '',
    dropOff: null,
    etaLabel: null,
    amountLabel: null,
    ...extra,
  };
}

function account(id: string): AuthUser {
  return {
    id,
    firstName: id,
    lastName: '',
    email: `${id}@example.com`,
    emailVerified: true,
  };
}

function shipment(title: string): { data: unknown[] } {
  return {
    data: [
      {
        tracking_id: title.replace('Parcel ', 'TRACK-'),
        parcel: { short_description: title },
        status: 'pending',
      },
    ],
  };
}
