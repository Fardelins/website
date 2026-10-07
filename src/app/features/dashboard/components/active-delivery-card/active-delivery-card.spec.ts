import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AuthService } from '@core/auth/auth.service';
import { GeocodingService } from '@core/services/geocoding.service';
import { RoutingService } from '@core/services/routing.service';
import { DeliveriesService } from '@features/deliveries/deliveries.service';
import { DeliveryDetail } from '@features/deliveries/deliveries.model';
import { ActiveDeliveryCardData } from '../../dashboard.models';
import { ActiveDeliveryCard } from './active-delivery-card';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const parcel = (trackingId: string): ActiveDeliveryCardData => ({
  trackingId,
  title: `Item ${trackingId}`,
  recipientName: `Receiver ${trackingId}`,
  destination: `To ${trackingId}`,
  etaLabel: '',
  status: 'enroute',
  phaseIndex: 2,
  orderDate: 'Sep 7, 2026',
});
const detail = (id: string): DeliveryDetail => ({
  trackingId: id,
  title: `Item ${id}`,
  status: 'enroute',
  imageUrl: null,
  createdLabel: 'Sep 7, 2026',
  dropOff: `To ${id}`,
  etaLabel: null,
  amountLabel: null,
  senderName: null,
  receiverName: `Receiver ${id}`,
  pickupAddress: `From ${id}`,
  dropOffAddress: `To ${id}`,
  courierName: null,
  distanceLabel: null,
  paid: true,
  events: [],
  currentPhaseIndex: 2,
});

describe('ActiveDeliveryCard route selection', () => {
  let fixture: ComponentFixture<ActiveDeliveryCard>;
  let requests: Map<string, ReturnType<typeof deferred<DeliveryDetail>>>;
  let locate: ReturnType<typeof vi.fn>;
  const flush = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
    fixture.detectChanges();
  };
  beforeEach(() => {
    requests = new Map(['A', 'B', 'C'].map((id) => [id, deferred<DeliveryDetail>()]));
    locate = vi.fn(async (address: string) => ({
      lat: address.includes('From') ? 6 : 7,
      lon: address.endsWith('C') ? 5 : 3,
      matched: address,
      approximate: false,
    }));
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { user: signal(null) } },
        {
          provide: DeliveriesService,
          useValue: { detail: (id: string) => requests.get(id)!.promise },
        },
        { provide: GeocodingService, useValue: { locate, locateCountry: vi.fn(async () => null) } },
        {
          provide: RoutingService,
          useValue: {
            route: vi.fn(async () => ({
              coordinates: [
                [3, 6],
                [3, 7],
              ],
              distanceKm: 10,
            })),
            pointAt: vi.fn(() => [3, 6.5]),
          },
        },
      ],
    });
    TestBed.overrideComponent(ActiveDeliveryCard, { set: { template: '', imports: [] } });
    fixture = TestBed.createComponent(ActiveDeliveryCard);
    fixture.componentRef.setInput('deliveries', ['A', 'B', 'C'].map(parcel));
    fixture.detectChanges();
  });

  it('keeps details and geometry together and ignores stale route responses', async () => {
    requests.get('A')!.resolve(detail('A'));
    await flush();
    const component = fixture.componentInstance;
    expect(component['routeState']().origin).toBe('From A');
    component['next']();
    fixture.detectChanges();
    expect(component['selected']()?.trackingId).toBe('A');
    expect(component['routeState']().origin).toBe('From A');
    component['next']();
    fixture.detectChanges();
    requests.get('C')!.resolve(detail('C'));
    await flush();
    expect(component['selected']()?.trackingId).toBe('C');
    expect(component['routeState']().origin).toBe('From C');
    requests.get('B')!.resolve(detail('B'));
    await flush();
    expect(component['selected']()?.trackingId).toBe('C');
    expect(component['routeState']().origin).toBe('From C');
  });

  it('clears old geometry when the next parcel has unavailable addresses', async () => {
    requests.get('A')!.resolve(detail('A'));
    await flush();
    locate.mockResolvedValue(null);
    fixture.componentInstance['next']();
    fixture.detectChanges();
    requests.get('B')!.resolve(detail('B'));
    await flush();
    expect(fixture.componentInstance['selected']()?.trackingId).toBe('B');
    expect(fixture.componentInstance['routeState']().points).toEqual([]);
    expect(fixture.componentInstance['routeState']().line).toEqual([]);
  });

  it('returns to the overview when deliveries become empty during a request', async () => {
    fixture.componentRef.setInput('deliveries', []);
    fixture.detectChanges();
    requests.get('A')!.resolve(detail('A'));
    await flush();
    expect(fixture.componentInstance['selected']()).toBeNull();
    expect(fixture.componentInstance['routeState']().points).toEqual([]);
  });
  it('moves back immediately after the list shrinks at its last index', async () => {
    requests.get('A')!.resolve(detail('A'));
    requests.get('B')!.resolve(detail('B'));
    requests.get('C')!.resolve(detail('C'));
    await flush();
    const component = fixture.componentInstance;
    component['next']();
    fixture.detectChanges();
    await flush();
    component['next']();
    fixture.detectChanges();
    await flush();
    fixture.componentRef.setInput('deliveries', [parcel('A'), parcel('B')]);
    fixture.detectChanges();
    await flush();
    expect(component['selected']()?.trackingId).toBe('B');
    component['previous']();
    fixture.detectChanges();
    await flush();
    expect(component['selected']()?.trackingId).toBe('A');
  });
});
