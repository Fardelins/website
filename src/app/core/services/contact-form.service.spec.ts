import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ContactFormService } from './contact-form.service';

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

  it('rejects when the API request fails', async () => {
    const pending = service.send(message);

    const req = httpMock.expectOne('/v1/public/contact-us');
    req.flush({ message: 'Invalid' }, { status: 400, statusText: 'Bad Request' });

    await expect(pending).rejects.toBeTruthy();
  });
});
