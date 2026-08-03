import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ContactFormService, ContactFormValidationError } from './contact-form.service';

const message = {
  firstName: 'Testboss',
  lastName: 'Product',
  company: 'Fardelins Test',
  email: 'product@example.com',
  subject: 'Partnership',
  message: 'Test by Bami',
};

describe('ContactFormService', () => {
  let service: ContactFormService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ContactFormService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('posts the trimmed message in the API field mapping', async () => {
    const pending = service.send(message);

    const req = httpMock.expectOne('/v1/public/contact-us');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      first_name: 'Testboss',
      last_name: 'Product',
      email: 'product@example.com',
      company_name: 'Fardelins Test',
      subject: 'Partnership',
      message: 'Test by Bami',
    });
    req.flush({ success: true });

    await expect(pending).resolves.toBeUndefined();
  });

  it('omits an empty company name instead of sending a blank string', async () => {
    const pending = service.send({ ...message, company: '  ' });

    const req = httpMock.expectOne('/v1/public/contact-us');
    expect(req.request.body.company_name).toBeUndefined();
    req.flush({ success: true });

    await pending;
  });

  it('surfaces a 400 field validation failure as a ContactFormValidationError', async () => {
    const pending = service.send(message);

    const req = httpMock.expectOne('/v1/public/contact-us');
    req.flush(
      { message: ['email must be an email'], error: 'Bad Request', statusCode: 400 },
      { status: 400, statusText: 'Bad Request' },
    );

    await expect(pending).rejects.toBeInstanceOf(ContactFormValidationError);
    await expect(pending).rejects.toMatchObject({ issues: ['email must be an email'] });
  });

  it('rejects a real server failure without treating it as a validation error', async () => {
    const pending = service.send(message);

    const req = httpMock.expectOne('/v1/public/contact-us');
    req.flush({ message: 'Internal error' }, { status: 500, statusText: 'Server Error' });

    await expect(pending).rejects.not.toBeInstanceOf(ContactFormValidationError);
  });
});
