import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GOOGLE_PLACES_KEY, GooglePlacesService, parsePlace } from './google-places.service';

const DURUMI_PLACE = {
  id: 'abc',
  displayName: { text: 'Soulmate House' },
  formattedAddress: 'Plot 188, Cadastral Zone B02, American Diya Rd, Durumi, Abuja 900108, Nigeria',
  location: { latitude: 9.0, longitude: 7.4 },
  addressComponents: [
    { longText: 'American Diya Road', shortText: 'American Diya Rd', types: ['route'] },
    { longText: 'Durumi', shortText: 'Durumi', types: ['sublocality_level_1', 'sublocality'] },
    { longText: 'Abuja', shortText: 'Abuja', types: ['locality', 'political'] },
    {
      longText: 'Federal Capital Territory',
      shortText: 'FCT',
      types: ['administrative_area_level_1'],
    },
    { longText: 'Nigeria', shortText: 'NG', types: ['country'] },
    { longText: '900108', shortText: '900108', types: ['postal_code'] },
  ],
};

describe('parsePlace', () => {
  it('keeps the street part and hands the state and city names over separately', () => {
    const place = parsePlace(DURUMI_PLACE, 'fallback');
    // The neighbourhood stays in the street line; it is also offered as the city.
    expect(place.street).toBe('Plot 188, Cadastral Zone B02, American Diya Rd, Durumi');
    expect(place.state).toBe('Federal Capital Territory');
    expect(place.cityCandidates).toEqual(['Durumi', 'Abuja']);
    expect(place).toMatchObject({ latitude: 9.0, longitude: 7.4, placeId: 'abc' });
  });

  it('drops a plus code and falls back to the place name when nothing is left', () => {
    const place = parsePlace(
      {
        displayName: { text: 'Wuse Market' },
        formattedAddress: '7MM9+X8, Abuja, Nigeria',
        addressComponents: [
          { longText: 'Abuja', types: ['locality'] },
          { longText: 'Nigeria', shortText: 'NG', types: ['country'] },
        ],
      },
      'Wuse',
    );
    expect(place.street).toBe('Wuse Market');
  });
});

describe('GooglePlacesService', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const serviceWith = (key: string) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: GOOGLE_PLACES_KEY, useValue: key }] });
    return TestBed.inject(GooglePlacesService);
  };
  const reply = (body: unknown) => ({ ok: true, json: async () => body });

  it('does nothing without a key, so the field stays a plain text box', async () => {
    const service = serviceWith('');
    fetchMock.mockResolvedValue(reply({ googlePlacesKey: '' }));
    expect(await service.suggest('Durumi')).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/public-config');
  });

  it('fetches the key from the server once, then searches with it', async () => {
    const service = serviceWith('');
    fetchMock.mockImplementation(async (url: string) =>
      url === '/api/public-config'
        ? reply({ googlePlacesKey: 'server-key' })
        : reply({ suggestions: [] }),
    );
    await service.suggest('Durumi');
    await service.suggest('Durumi Abuja');
    const configCalls = fetchMock.mock.calls.filter(([url]) => url === '/api/public-config');
    expect(configCalls).toHaveLength(1);
    expect(fetchMock.mock.calls[1][1].headers['X-Goog-Api-Key']).toBe('server-key');
  });

  it('waits for three characters before searching', async () => {
    const service = serviceWith('key');
    expect(await service.suggest('Du')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('searches Nigeria with the key and a session token, and lists the suggestions', async () => {
    const service = serviceWith('test-key');
    fetchMock.mockResolvedValue(
      reply({
        suggestions: [
          {
            placePrediction: {
              placeId: 'p1',
              structuredFormat: {
                mainText: { text: 'Soulmate House' },
                secondaryText: { text: 'Durumi, Abuja' },
              },
            },
          },
          { queryPrediction: { text: { text: 'ignored' } } },
        ],
      }),
    );

    const found = await service.suggest('Soulmate');

    expect(found).toEqual([
      { placeId: 'p1', primary: 'Soulmate House', secondary: 'Durumi, Abuja' },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://places.googleapis.com/v1/places:autocomplete');
    expect(init.headers['X-Goog-Api-Key']).toBe('test-key');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ input: 'Soulmate', includedRegionCodes: ['ng'] });
    expect(body.sessionToken).toEqual(expect.any(String));
  });

  it('gives no suggestions when Google answers with an error', async () => {
    const service = serviceWith('key');
    fetchMock.mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    expect(await service.suggest('Durumi')).toEqual([]);
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await service.suggest('Durumi')).toEqual([]);
  });

  it('loads the place with the same session token, then starts a new session', async () => {
    const service = serviceWith('key');
    fetchMock.mockResolvedValue(reply({ suggestions: [] }));
    await service.suggest('Soulmate');
    const searchToken = JSON.parse(fetchMock.mock.calls[0][1].body).sessionToken;

    fetchMock.mockResolvedValue(reply(DURUMI_PLACE));
    const details = await service.details({
      placeId: 'abc',
      primary: 'Soulmate House',
      secondary: '',
    });

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toContain('/places/abc');
    expect(url).toContain(`sessionToken=${searchToken}`);
    expect(init.headers['X-Goog-FieldMask']).toContain('addressComponents');
    expect(details?.state).toBe('Federal Capital Territory');

    fetchMock.mockResolvedValue(reply({ suggestions: [] }));
    await service.suggest('Another');
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).sessionToken).not.toBe(searchToken);
  });

  it('answers null when the place cannot be loaded', async () => {
    const service = serviceWith('key');
    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await service.details({ placeId: 'x', primary: 'X', secondary: '' })).toBeNull();
  });
});
