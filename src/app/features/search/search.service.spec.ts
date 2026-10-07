import { Injector, runInInjectionContext } from '@angular/core';
import { DeliveriesService } from '@features/deliveries/deliveries.service';
import { SearchService } from './search.service';

function makeService(): SearchService {
  const injector = Injector.create({
    providers: [{ provide: DeliveriesService, useValue: { list: () => Promise.resolve([]) } }],
  });
  return runInInjectionContext(injector, () => new SearchService());
}

/** Flattened titles in rank order, which is what the palette actually shows. */
function titles(service: SearchService, query: string): string[] {
  return service
    .search(query, null)
    .flatMap((group) => group.results)
    .map((result) => result.title);
}

describe('SearchService', () => {
  it('finds Create delivery from the phrases people actually type', () => {
    const service = makeService();
    // Every one of these missed before the index carried intent keywords.
    for (const query of [
      'send delivery',
      'send a package',
      'book me',
      'book a rider',
      'create',
      'new parcel',
      'ship something',
      'courier',
    ]) {
      expect(titles(service, query), `"${query}" should surface Create delivery`).toContain(
        'Create delivery',
      );
    }
  });

  it('drops stop words so a natural question still ranks', () => {
    const service = makeService();
    expect(titles(service, 'where is my parcel').length).toBeGreaterThan(0);
    expect(titles(service, 'how much does it cost').length).toBeGreaterThan(0);
  });

  it('routes a money question to the refund topic', () => {
    const service = makeService();
    expect(titles(service, 'refund').join(' ').toLowerCase()).toContain('refund');
  });

  it('treats an id-shaped term as tracking, not as a word', () => {
    const service = makeService();
    expect(service.search('FDL9K2M4X7', null).some((g) => g.scope === 'tracking')).toBe(true);
  });

  it('does not treat an ordinary word as a tracking id', () => {
    const service = makeService();
    expect(service.search('macbook', null).some((g) => g.scope === 'tracking')).toBe(false);
  });

  it('returns nothing for genuine nonsense', () => {
    expect(titles(makeService(), 'zzzqqq')).toHaveLength(0);
  });

  it('honours an explicit scope filter', () => {
    const groups = makeService().search('delivery', 'help');
    expect(groups.every((group) => group.scope === 'help')).toBe(true);
  });
});
