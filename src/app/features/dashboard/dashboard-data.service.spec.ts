import { DeliverySummary } from '@features/deliveries/deliveries.model';
import { DashboardDataService } from './dashboard-data.service';

const parcel = (overrides: Partial<DeliverySummary> = {}): DeliverySummary => ({
  trackingId: 'FDL-1001',
  title: 'Care package',
  status: 'in transit',
  imageUrl: null,
  createdLabel: 'Aug 30, 2026',
  dropOff: 'Accra, Ghana',
  etaLabel: 'Tomorrow, 2:30 PM',
  amountLabel: '₦25,000',
  createdAt: '2026-08-30T10:00:00.000Z',
  etaAt: '2026-09-02T13:30:00.000Z',
  amount: 25_000,
  currency: 'NGN',
  receiverName: 'Ama Mensah',
  ...overrides,
});

describe('DashboardDataService', () => {
  const service = new DashboardDataService();

  // The windows end today; the fixtures are dated around 2 Sep 2026.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-02T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('aggregates sender metrics and orders active deliveries by ETA', () => {
    const data = service.build(
      [
        parcel(),
        parcel({
          trackingId: 'FDL-1002',
          status: 'processing',
          etaAt: '2026-09-01T09:00:00.000Z',
          amount: 10_000,
          receiverName: 'Tobi Lawal',
        }),
        parcel({
          trackingId: 'FDL-1003',
          status: 'received',
          amount: 15_000,
          receiverName: 'Kemi Ade',
        }),
      ],
      'all-time',
      'en-NG',
    );

    expect(data.isEmpty).toBe(false);
    expect(data.metrics.find((metric) => metric.key === 'in-transit')?.value).toBe(2);
    expect(data.metrics.find((metric) => metric.key === 'delivered')?.value).toBe(1);
    expect(data.metrics.find((metric) => metric.key === 'total')?.value).toBe(3);
    expect(data.metrics.find((metric) => metric.key === 'spend')?.value).toBe(50_000);
    expect(data.activeDeliveries.map((delivery) => delivery.trackingId)).toEqual([
      'FDL-1002',
      'FDL-1001',
    ]);
  });

  it('returns a stable empty dashboard model', () => {
    const data = service.build([], 'all-time', 'en-NG');

    expect(data.isEmpty).toBe(true);
    expect(data.activeDeliveries).toEqual([]);
    expect(data.recentParcels).toEqual([]);
    expect(data.metrics.map((metric) => metric.value)).toEqual([0, 0, 0, 0]);

    const now = new Date();
    const daysInLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    expect(data.activity['last-7-days']).toHaveLength(7);
    expect(data.activity['last-30-days']).toHaveLength(30);
    expect(data.activity['last-month']).toHaveLength(daysInLastMonth);
    expect(data.activity['last-6-months']).toHaveLength(6);
    expect(data.activity['this-year']).toHaveLength(now.getMonth() + 1);
  });
  it('keeps every range consistent across totals, delivered counts, spend and chart buckets', () => {
    vi.setSystemTime(new Date('2026-09-07T12:00:00Z'));
    const parcels = [
      parcel({
        trackingId: 'a',
        createdAt: '2026-09-07T10:00:00Z',
        status: 'received',
        amount: 100,
      }),
      parcel({
        trackingId: 'b',
        createdAt: '2026-09-02T10:00:00Z',
        status: 'enroute',
        amount: 200,
      }),
      parcel({
        trackingId: 'c',
        createdAt: '2026-08-15T10:00:00Z',
        status: 'assigned',
        amount: 300,
      }),
      parcel({
        trackingId: 'd',
        createdAt: '2026-02-15T10:00:00Z',
        status: 'completed',
        amount: 400,
      }),
    ];
    for (const [range, total, spend, delivered] of [
      ['last-7-days', 2, 300, 1],
      ['last-30-days', 3, 600, 1],
      ['last-month', 1, 300, 0],
      ['last-6-months', 3, 600, 1],
      ['this-year', 4, 1000, 2],
    ] as const) {
      const data = service.build(parcels, 'all-time', 'en-NG', range);
      expect(data.metrics.find((m) => m.key === 'total')!.value).toBe(total);
      expect(data.metrics.find((m) => m.key === 'spend')!.value).toBe(spend);
      expect(data.metrics.find((m) => m.key === 'delivered')!.value).toBe(delivered);
      expect(data.metrics.find((m) => m.key === 'delivered')!.breakdown?.total).toBe(total);
      expect(data.activity[range].reduce((sum, p) => sum + p.total, 0)).toBe(total);
      expect(data.activity[range].reduce((sum, p) => sum + p.delivered, 0)).toBe(delivered);
      expect(data.recentParcels).toHaveLength(4);
    }
    expect(
      service
        .build(parcels, 'all-time', 'en-NG', 'last-7-days')
        .metrics.find((m) => m.key === 'total')!.caption,
    ).toBe('Parcels in the last 7 days');
  });

  it('leaves unpaid parcels out of spend and shows them as awaiting payment instead', () => {
    const paid = parcel({ trackingId: 'paid', status: 'assigned', amount: 2_600 });
    const unpaid = parcel({ trackingId: 'unpaid', status: 'awaiting_payment', amount: 7_800 });
    const spendOf = (parcels: DeliverySummary[], range?: 'this-year') =>
      service.build(parcels, 'all-time', 'en-NG', range).metrics.find((m) => m.key === 'spend')!;

    const both = spendOf([paid, unpaid]);
    expect(both.value).toBe(2_600);
    expect(both.caption).toBe('₦7,800 awaiting payment');

    const none = spendOf([paid]);
    expect(none.value).toBe(2_600);
    expect(none.caption).toContain('$');

    const onlyUnpaid = spendOf([unpaid], 'this-year');
    expect(onlyUnpaid.value).toBe(0);
    expect(onlyUnpaid.caption).toBe('₦7,800 awaiting payment');
  });

  it('adds up spend in the main currency only, so one foreign parcel cannot change the symbol', () => {
    const naira = [
      parcel({ trackingId: 'n1', amount: 2_600 }),
      parcel({ trackingId: 'n2', amount: 3_400 }),
    ];
    const tunisian = parcel({ trackingId: 't1', amount: 600, currency: 'TND' });
    const spend = service
      .build([tunisian, ...naira], 'all-time', 'en-NG')
      .metrics.find((m) => m.key === 'spend')!;

    expect(spend.value).toBe(6_000);
    expect(spend.displayValue).toContain('₦');
    expect(spend.displayValue).not.toContain('TND');
  });

  it('keeps out-for-delivery parcels active and aggregates assigned into pending', () => {
    const data = service.build(
      [
        parcel({ status: 'delivered' }),
        parcel({ trackingId: 'assigned', status: 'assigned' }),
        parcel({ trackingId: 'received', status: 'received' }),
      ],
      'all-time',
      'en-NG',
      'last-7-days',
    );
    expect(data.activeDeliveries.map((p) => p.trackingId)).toEqual(['FDL-1001', 'assigned']);
    const buckets = data.activity['last-7-days'];
    expect(buckets.reduce((sum, p) => sum + p.transit, 0)).toBe(1);
    expect(buckets.reduce((sum, p) => sum + p.pending, 0)).toBe(1);
    expect(buckets.reduce((sum, p) => sum + p.delivered, 0)).toBe(1);
  });
});
