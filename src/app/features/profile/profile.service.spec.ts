import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { DEV_USER } from '@core/auth/dev-mock';
import { TokenStore } from '@core/auth/token-store';
import { ProfileService } from './profile.service';

describe('ProfileService avatar upload', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('sends the avatar under the single-image field and keeps the returned profile', async () => {
    const service = TestBed.inject(ProfileService);
    const store = TestBed.inject(TokenStore);
    const http = TestBed.inject(HttpTestingController);
    const file = new File(['avatar'], 'profile.jpg', { type: 'image/jpeg' });

    const upload = service.uploadAvatar(file);
    const request = http.expectOne('/v1/upload/avatar');
    const body = request.request.body as FormData;
    const uploaded = body.get('image') as File;

    expect(request.request.method).toBe('POST');
    expect(uploaded.name).toBe(file.name);
    expect(uploaded.type).toBe(file.type);
    expect(body.has('file')).toBe(false);
    expect(body.has('avatar')).toBe(false);

    request.flush({
      id: 'f74531a6-7dcc-4bdd-a94c-9d1dacfa3326',
      first_name: 'Tester',
      last_name: 'Prod',
      email: 'product@yopmail.com',
      phone: '+2349042819273',
      status: 'pending',
      avatar: 'https://res.cloudinary.com/fardelins/image/upload/profile.jpg',
    });

    await upload;
    expect(store.user()).toEqual(
      expect.objectContaining({
        id: 'f74531a6-7dcc-4bdd-a94c-9d1dacfa3326',
        firstName: 'Tester',
        lastName: 'Prod',
        avatarUrl: 'https://res.cloudinary.com/fardelins/image/upload/profile.jpg',
      }),
    );
  });

  it('keeps the avatar URL returned as the upload response data', async () => {
    const service = TestBed.inject(ProfileService);
    const store = TestBed.inject(TokenStore);
    const http = TestBed.inject(HttpTestingController);
    const avatarUrl =
      'https://res.cloudinary.com/fardelins/image/upload/v1789062278/server/avatar/file_nybyqu.webp';
    store.setUser({
      id: 'user-1',
      firstName: 'Tester',
      lastName: 'Prod',
      email: 'product@yopmail.com',
      emailVerified: true,
    });

    const upload = service.uploadAvatar(
      new File(['avatar'], 'profile.jpg', { type: 'image/jpeg' }),
    );
    http.expectOne('/v1/upload/avatar').flush({ message: 'Updated', code: 200, data: avatarUrl });

    await upload;
    expect(store.user()?.avatarUrl).toBe(avatarUrl);
  });

  it('sends the ID types under the names BE files them by, and labels them back in the list', async () => {
    const service = TestBed.inject(ProfileService);
    const http = TestBed.inject(HttpTestingController);
    const file = new File(['id'], 'id.jpg', { type: 'image/jpeg' });

    const upload = service.uploadDocument(file, 'NIN', '12345678901');
    const request = http.expectOne('/v1/verification-document/upload/user');
    expect((request.request.body as FormData).get('name')).toBe('national identity management');
    request.flush({ code: 201 });
    await upload;

    const list = service.documents();
    http.expectOne('/v1/verification-document').flush({
      data: [{ id: 'a', name: 'international passport', status: 'pending' }],
    });
    expect(await list).toEqual([expect.objectContaining({ type: 'Passport' })]);
  });

  it('uses the verification-document multipart contract', async () => {
    const service = TestBed.inject(ProfileService);
    const http = TestBed.inject(HttpTestingController);
    const file = new File(['passport'], 'passport.pdf', { type: 'application/pdf' });

    const upload = service.uploadDocument(file, 'Passport', 'A12345678');
    const request = http.expectOne('/v1/verification-document/upload/user');
    const body = request.request.body as FormData;

    expect(request.request.method).toBe('POST');
    expect(body.get('name')).toBe('international passport');
    expect(body.get('unique_identifier')).toBe('A12345678');
    expect((body.get('document') as File).name).toBe(file.name);
    expect((body.get('document') as File).type).toBe(file.type);
    expect(body.has('file')).toBe(false);
    expect(body.has('type')).toBe(false);

    request.flush({ message: 'Document created successfully.', code: 201 });
    await expect(upload).resolves.toBeUndefined();
  });

  it("loads the customer's own transaction history with the required paging params", async () => {
    const service = TestBed.inject(ProfileService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.transactions();
    const request = http.expectOne((req) => req.url === '/v1/user/transactions');

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('limit')).toBe('100');
    request.flush({ data: [] });
    await expect(pending).resolves.toEqual([]);
  });

  // Row shape as BE described it: shipment payments, `transaction` null until the gateway is hit.
  const paymentRow = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    payment_method: 'paystack',
    amount: 2500,
    admin_fee: 100,
    admin_interest: 0,
    status: 'pending',
    mode: 'live',
    shipment_id: 'ship-1',
    created_at: '2026-09-25T10:15:00.000Z',
    updated_at: '2026-09-25T10:15:00.000Z',
    transaction: null,
    ...extra,
  });

  it('shows a shipment payment as money out, with the row id standing in for a missing reference', async () => {
    const service = TestBed.inject(ProfileService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.transactions();
    http
      .expectOne((req) => req.url === '/v1/user/transactions')
      .flush({ data: [paymentRow('pay-1')] });

    await expect(pending).resolves.toEqual([
      expect.objectContaining({
        id: 'pay-1',
        reference: 'pay-1',
        description: 'Delivery Payment',
        amount: 2500,
        amountLabel: '₦2,500',
        status: 'pending',
        credit: false,
        trackingId: null,
      }),
    ]);
  });

  it('prefers the gateway reference once the payment has a transaction record', async () => {
    const service = TestBed.inject(ProfileService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.transactions();
    http
      .expectOne((req) => req.url === '/v1/user/transactions')
      .flush({
        data: [
          paymentRow('pay-2', {
            transaction: { transaction_id: 'emrn5ab4qc', status: 'success', type: 'CREDIT' },
          }),
        ],
      });

    await expect(pending).resolves.toEqual([
      expect.objectContaining({ id: 'pay-2', reference: 'emrn5ab4qc' }),
    ]);
  });

  it('keeps paging until BE says there is no next page', async () => {
    const service = TestBed.inject(ProfileService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.transactions();
    const first = http.expectOne((req) => req.url === '/v1/user/transactions');
    expect(first.request.params.get('page')).toBe('1');
    first.flush({ data: [paymentRow('a')], pagination: { has_next_page: true } });

    await vi.waitFor(() => {
      const second = http.expectOne((req) => req.url === '/v1/user/transactions');
      expect(second.request.params.get('page')).toBe('2');
      second.flush({ data: [paymentRow('b')], pagination: { has_next_page: false } });
    });

    await expect(pending).resolves.toEqual([
      expect.objectContaining({ id: 'a' }),
      expect.objectContaining({ id: 'b' }),
    ]);
  });

  it('stops after one page when the paging envelope is missing', async () => {
    const service = TestBed.inject(ProfileService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.transactions();
    http.expectOne((req) => req.url === '/v1/user/transactions').flush({ data: [paymentRow('a')] });

    await expect(pending).resolves.toHaveLength(1);
  });

  it('fetches submissions from the bare verification-document endpoint, not the ID-type catalog', async () => {
    const service = TestBed.inject(ProfileService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.documents();
    const request = http.expectOne('/v1/verification-document');
    expect(request.request.method).toBe('GET');
    // Real shape from the backend's own Bruno collection: upload is nested, no top-level url/country.
    request.flush({
      message: 'document fetched sucessfully.',
      code: 200,
      data: [
        {
          id: 2,
          customerId: null,
          name: 'Corporate Affairs Commission',
          status: 'pending',
          unique_identifier: '1856409',
          expiry: null,
          upload: { id: 4, link: 'https://res.cloudinary.com/fardelins/image/upload/file.pdf' },
        },
      ],
    });

    await expect(pending).resolves.toEqual([
      expect.objectContaining({ id: '2', type: 'Corporate Affairs Commission', status: 'pending' }),
    ]);
  });

  it('keeps mock verification documents local without calling the API', async () => {
    const service = TestBed.inject(ProfileService);
    const store = TestBed.inject(TokenStore);
    const http = TestBed.inject(HttpTestingController);
    store.setUser(DEV_USER);

    await service.uploadDocument(
      new File(['passport'], 'passport.pdf', { type: 'application/pdf' }),
      'Passport',
      'A12345678',
    );

    expect(await service.documents()).toEqual([
      expect.objectContaining({ type: 'Passport', status: 'pending' }),
    ]);
    http.expectNone('/v1/verification-document/upload/user');
    http.expectNone('/v1/verification-document');
  });

  it("finds a parcel's completed payment, paging only until it turns up", async () => {
    const service = TestBed.inject(ProfileService);
    const http = TestBed.inject(HttpTestingController);
    const row = (id: string, tracking: string, status: string) => ({
      id,
      shipment_id: `ship-${id}`,
      tracking_id: tracking,
      payment_method: 'paystack',
      amount: 2600,
      status,
      created_at: '2026-10-09T09:00:00Z',
      transaction: { transaction_id: `T${id}`, channel: 'bank_transfer' },
    });

    const pending = service.paymentFor('FDL-2');
    http
      .expectOne((req) => req.url === '/v1/user/transactions' && req.params.get('page') === '1')
      .flush({ data: [row('1', 'FDL-1', 'paid')], has_next_page: true });
    await vi.waitFor(() =>
      http
        .expectOne((req) => req.url === '/v1/user/transactions' && req.params.get('page') === '2')
        .flush({
          data: [row('2', 'FDL-2', 'pending'), row('3', 'FDL-2', 'paid')],
          has_next_page: true,
        }),
    );

    const payment = await pending;
    expect(payment).toMatchObject({
      reference: 'T3',
      method: 'paystack',
      channel: 'bank_transfer',
      status: 'paid',
    });
    http.expectNone((req) => req.params.get('page') === '3');
  });

  it('answers null when the parcel has no completed payment', async () => {
    const service = TestBed.inject(ProfileService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.paymentFor('FDL-9');
    http
      .expectOne((req) => req.url === '/v1/user/transactions')
      .flush({
        data: [{ id: '1', shipment_id: 's', tracking_id: 'FDL-9', status: 'pending', amount: 100 }],
        has_next_page: false,
      });

    await expect(pending).resolves.toBeNull();
  });

  it('lists the newest submission first and names it by the ID type, not the BE bucket', async () => {
    const service = TestBed.inject(ProfileService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.documents();
    http.expectOne('/v1/verification-document').flush({
      data: [
        {
          id: 1,
          name: 'Passport',
          type: 'domestic',
          status: 'rejected',
          created_at: '2026-10-01T09:00:00Z',
        },
        {
          id: 2,
          name: 'NIN',
          type: 'domestic',
          status: 'pending',
          created_at: '2026-10-09T09:00:00Z',
        },
      ],
    });

    await expect(pending).resolves.toEqual([
      expect.objectContaining({ id: '2', type: 'NIN', status: 'pending' }),
      expect.objectContaining({ id: '1', type: 'Passport', status: 'rejected' }),
    ]);
  });
});
