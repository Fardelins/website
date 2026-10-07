import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LocalityService } from './locality.service';

describe('LocalityService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('resolves a country id by name, case-insensitively', async () => {
    const service = TestBed.inject(LocalityService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.countryId('NIGERIA');
    http.expectOne('/v1/locality/countries').flush({
      data: [
        { id: 190, name: 'nigeria' },
        { id: 161, name: 'egypt' },
      ],
    });

    await expect(pending).resolves.toBe(190);
  });

  it('returns null for an unknown country instead of throwing', async () => {
    const service = TestBed.inject(LocalityService);
    const http = TestBed.inject(HttpTestingController);

    const pending = service.countryId('Atlantis');
    http.expectOne('/v1/locality/countries').flush({ data: [{ id: 190, name: 'nigeria' }] });

    await expect(pending).resolves.toBeNull();
  });

  it('caches the countries request across repeated calls', async () => {
    const service = TestBed.inject(LocalityService);
    const http = TestBed.inject(HttpTestingController);

    const first = service.countries();
    http.expectOne('/v1/locality/countries').flush({ data: [{ id: 190, name: 'nigeria' }] });
    await first;

    await expect(service.countries()).resolves.toEqual([{ id: 190, label: 'nigeria' }]);
    http.expectNone('/v1/locality/countries');
  });
});
