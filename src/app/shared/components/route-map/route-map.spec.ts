import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DashboardPreferencesService } from '@core/services/dashboard-preferences.service';
import { RouteMap } from './route-map';

describe('RouteMap updates', () => {
  it('reuses the map and source across routes, then clears geometry for an overview', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: DashboardPreferencesService,
          useValue: { effectiveTheme: signal('dark'), motionEnabled: signal(false) },
        },
      ],
    });
    const fixture = TestBed.createComponent(RouteMap);
    const source = { setData: vi.fn() };
    const travelled = { setData: vi.fn() };
    const map = {
      getSource: vi.fn((id: string) => (id === 'route' ? source : travelled)),
      fitBounds: vi.fn(),
      easeTo: vi.fn(),
      stop: vi.fn(),
      remove: vi.fn(),
      addSource: vi.fn(),
    };
    const component = fixture.componentInstance;
    component['map'] = map as unknown as NonNullable<(typeof component)['map']>;
    component['library'] = {
      LngLatBounds: class {
        extend() {}
      },
    } as unknown as NonNullable<(typeof component)['library']>;
    component['styleReady'] = true;
    component['theme'] = 'dark';
    fixture.componentRef.setInput('route', [
      [3, 6],
      [3.5, 7],
    ]);
    fixture.detectChanges();
    expect(source.setData).toHaveBeenLastCalledWith({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [3, 6],
              [3.5, 7],
            ],
          },
        },
      ],
    });
    fixture.componentRef.setInput('route', [
      [4, 8],
      [5, 9],
    ]);
    fixture.detectChanges();
    expect(component['map']).toBe(map);
    expect(map.remove).not.toHaveBeenCalled();
    expect(map.addSource).not.toHaveBeenCalled();
    expect(map.fitBounds).toHaveBeenCalledTimes(2);
    fixture.componentRef.setInput('route', []);
    fixture.detectChanges();
    expect(source.setData).toHaveBeenLastCalledWith({ type: 'FeatureCollection', features: [] });
    expect(map.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [8.6753, 9.082], duration: 0 }),
    );
    fixture.destroy();
    expect(map.remove).toHaveBeenCalledOnce();
  });
});
