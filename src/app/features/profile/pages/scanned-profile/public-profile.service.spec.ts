import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PublicProfileService } from './public-profile.service';

describe('PublicProfileService', () => {
  let http: HttpTestingController;
  let service: PublicProfileService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(PublicProfileService);
  });

  afterEach(() => http.verify());

  it('turns the recipient search hit into a name, handle and photo', async () => {
    const pending = service.lookup('probe');
    const request = http.expectOne(
      (req) =>
        req.url === '/v1/shipment/recipients/search' && req.params.get('username') === 'probe',
    );
    request.flush({
      data: {
        id: 'x',
        username: 'probe',
        first_name: 'Probe',
        last_name: 'Recipient',
        avatar: null,
      },
    });

    await expect(pending).resolves.toEqual({
      username: 'probe',
      name: 'Probe Recipient',
      avatarUrl: null,
    });
  });

  it('gives null when nobody has that username', async () => {
    const pending = service.lookup('nobody');
    http.expectOne((req) => req.url === '/v1/shipment/recipients/search').flush({ data: null });

    await expect(pending).resolves.toBeNull();
  });

  it('does not ask BE about something that cannot be a username', async () => {
    await expect(service.lookup('not a name!')).resolves.toBeNull();
    await expect(service.lookup('a')).resolves.toBeNull();
    http.expectNone((req) => req.url.includes('recipients'));
  });

  it('lets a failed lookup surface, so the page can offer a retry', async () => {
    const pending = service.lookup('probe');
    http
      .expectOne((req) => req.url === '/v1/shipment/recipients/search')
      .flush({}, { status: 500, statusText: 'Server Error' });

    await expect(pending).rejects.toBeTruthy();
  });
});
