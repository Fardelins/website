import { dashboardParcelStatusGroup, parcelStatusGroup } from './parcel-status';
describe('shared parcel statuses', () => {
  it('uses one shipped group for the API transport stages', () => {
    for (const status of ['enroute', 'picked_up', 'delivered', 'out for delivery', 'shipped'])
      expect(parcelStatusGroup(status)).toBe('transit');
    expect(parcelStatusGroup('assigned')).toBe('assigned');
    expect(parcelStatusGroup('office')).toBe('transit');
    expect(parcelStatusGroup('pending')).toBe('pending');
    expect(parcelStatusGroup('received')).toBe('delivered');
    expect(parcelStatusGroup('completed')).toBe('delivered');
    expect(parcelStatusGroup('cancelled')).toBe('cancelled');
  });
  it('aggregates stationary statuses only for dashboard summaries', () => {
    expect(dashboardParcelStatusGroup('assigned')).toBe('pending');
    expect(dashboardParcelStatusGroup('office')).toBe('pending');
    expect(dashboardParcelStatusGroup('at office')).toBe('pending');
    expect(dashboardParcelStatusGroup('enroute')).toBe('transit');
  });
});
