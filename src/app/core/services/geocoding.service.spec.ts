import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GeocodingService } from './geocoding.service';

function photon(properties: Record<string, string>, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      json: async () => ({ features: [{ properties, geometry: { coordinates: [3.36, 6.6] } }] }),
    }),
  );
}

describe('GeocodingService.reverse', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('turns a street hit into an address and city candidates that end with the state', async () => {
    photon({
      type: 'street',
      name: 'Olufunke Atitebi Street',
      district: 'Oregun',
      city: 'Ikeja',
      state: 'Lagos',
    });

    const place = await TestBed.inject(GeocodingService).reverse(6.6, 3.36);

    expect(place).toEqual({
      street: 'Olufunke Atitebi Street',
      formattedAddress: 'Olufunke Atitebi Street, Oregun, Ikeja, Lagos',
      state: 'Lagos',
      cityCandidates: ['Ikeja', 'Oregun', 'Lagos'],
    });
  });

  it('keeps a named place and its street together', async () => {
    photon({
      type: 'other',
      name: 'Ikeja City Mall',
      street: 'Obafemi Awolowo Way',
      housenumber: '174',
      city: 'Ikeja',
      state: 'Lagos',
    });

    const place = await TestBed.inject(GeocodingService).reverse(6.6, 3.36);

    expect(place?.street).toBe('Ikeja City Mall, 174 Obafemi Awolowo Way');
  });

  it('falls back to the Abuja state name when the district is not a known city', async () => {
    photon({
      type: 'street',
      name: 'Constitution Avenue',
      city: 'Central Business District',
      county: 'Municipal Area Council',
      state: 'Federal Capital Territory',
    });

    const place = await TestBed.inject(GeocodingService).reverse(9.05, 7.49);

    expect(place?.cityCandidates.at(-1)).toBe('Federal Capital Territory');
  });

  it('gives null when the lookup fails or finds no state', async () => {
    photon({ name: 'Somewhere' });
    expect(await TestBed.inject(GeocodingService).reverse(1, 1)).toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await TestBed.inject(GeocodingService).reverse(1, 1)).toBeNull();
  });
});
