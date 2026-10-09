import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PaymentService, toOutcome } from './payment.service';

describe('PaymentService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('sends the reference to the verify endpoint and reads the status', async () => {
    const service = TestBed.inject(PaymentService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.verifyPaystack('emrn5ab4qc');
    const request = http.expectOne((req) => req.url === '/v1/payment/verify-paystack');

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('reference')).toBe('emrn5ab4qc');
    request.flush({ message: 'ok', code: 200, data: { status: 'success' } });

    await expect(pending).resolves.toBe('success');
  });

  it('reads the real paid response from dev', async () => {
    const service = TestBed.inject(PaymentService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.verifyPaystack('T029103440697589');
    http
      .expectOne((req) => req.url === '/v1/payment/verify-paystack')
      .flush({
        message: 'Transaction updated sucessfully.',
        code: 200,
        data: {
          reference: 'T029103440697589',
          status: 'success',
          amount: 2600,
          order_id: 'da9563fa',
          tracking_id: 'FDL-8814796241816',
        },
      });

    await expect(pending).resolves.toBe('success');
  });

  it('treats a 400 with status "abandoned" as a payment that was not completed', async () => {
    const service = TestBed.inject(PaymentService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.verifyPaystack('T-unpaid');
    http
      .expectOne((req) => req.url === '/v1/payment/verify-paystack')
      .flush(
        { statusCode: 400, message: 'Payment not completed', status: 'abandoned' },
        { status: 400, statusText: 'Bad Request' },
      );

    await expect(pending).resolves.toBe('failed');
  });

  const verifyFails = (http: HttpTestingController) =>
    http
      .expectOne((req) => req.url === '/v1/payment/verify-paystack')
      .flush(
        { statusCode: 400, message: 'Payment verification failed' },
        { status: 400, statusText: 'Bad Request' },
      );
  const settle = () => new Promise((resolve) => setTimeout(resolve));

  it("falls back to the customer's own transactions when the check returns 400", async () => {
    const service = TestBed.inject(PaymentService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.verifyPaystack('T662937065188922');
    verifyFails(http);
    await settle();
    http
      .expectOne((req) => req.url === '/v1/user/transactions')
      .flush({
        data: [
          {
            id: 'o-1',
            shipment_id: 's-1',
            status: 'paid',
            transaction: { transaction_id: 'T662937065188922' },
          },
          {
            id: 'o-2',
            shipment_id: 's-2',
            status: 'failed',
            transaction: { transaction_id: 'T111' },
          },
        ],
      });

    await expect(pending).resolves.toBe('success');
  });

  it('rejects when the check fails and the reference is not in the transactions either', async () => {
    const service = TestBed.inject(PaymentService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.verifyPaystack('T-unknown');
    verifyFails(http);
    await settle();
    http.expectOne((req) => req.url === '/v1/user/transactions').flush({ data: [] });

    await expect(pending).rejects.toBeTruthy();
  });

  it('restarts payment for an unpaid order and returns the Paystack page', async () => {
    const service = TestBed.inject(PaymentService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.resume('order-1');
    const request = http.expectOne(
      '/v1/customer-shipment/pending-payment-request/paystack/order-1',
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      message: 'Order updated sucessfully.',
      data: { authorization_url: 'https://checkout.paystack.com/abc', reference: 'T1' },
    });

    await expect(pending).resolves.toBe('https://checkout.paystack.com/abc');
  });

  it("surfaces BE's message when the payment cannot be restarted", async () => {
    const service = TestBed.inject(PaymentService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.resume('order-2');
    http
      .expectOne('/v1/customer-shipment/pending-payment-request/paystack/order-2')
      .flush({ message: 'Order already paid' }, { status: 400, statusText: 'Bad Request' });

    await expect(pending).rejects.toThrow('Order already paid');
  });

  it('rejects when the check itself fails, so the page can tell that apart from a failed payment', async () => {
    const service = TestBed.inject(PaymentService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.verifyPaystack('bad-ref');
    http
      .expectOne((req) => req.url === '/v1/payment/verify-paystack')
      .flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });
    await settle();
    http.expectOne((req) => req.url === '/v1/user/transactions').flush({ data: [] });

    await expect(pending).rejects.toBeTruthy();
  });
});

describe('toOutcome', () => {
  it('reads a status under data', () => {
    expect(toOutcome({ data: { status: 'success' } })).toBe('success');
    expect(toOutcome({ data: { status: 'abandoned' } })).toBe('failed');
  });

  it("reads Paystack's own response passed through under BE's data wrapper", () => {
    expect(toOutcome({ data: { status: true, data: { status: 'success' } } })).toBe('success');
    expect(toOutcome({ data: { status: true, data: { status: 'failed' } } })).toBe('failed');
  });

  it("ignores Paystack's boolean top-level status, which only means the lookup worked", () => {
    expect(toOutcome({ status: true, data: { status: 'ongoing' } })).toBe('pending');
  });

  it('never reports success for a shape it does not recognise', () => {
    expect(toOutcome({ message: 'payment verified', code: 200 })).toBe('pending');
    expect(toOutcome(null)).toBe('pending');
    expect(toOutcome({ data: { status: 'processing' } })).toBe('pending');
  });

  it('matches status words case-insensitively', () => {
    expect(toOutcome({ data: { status: 'SUCCESS' } })).toBe('success');
  });
});
