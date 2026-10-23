import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Mocked, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { HapticsService } from '@core/services/haptics.service';
import { SavedAddress, SavedAddressesService } from '@core/services/saved-addresses.service';
import { SendDeliveryService } from '@features/send-delivery/send-delivery.service';
import { Storefront } from '../../storefront.models';
import { StorefrontService } from '../../storefront.service';
import { StorefrontSettings } from './storefront-settings';

describe('StorefrontSettings', () => {
  let fixture: ComponentFixture<StorefrontSettings>;
  let api: Mocked<StorefrontService>;
  const savedItems = signal<SavedAddress[]>([]);
  const delivery = { states: vi.fn(), cities: vi.fn() };

  const connectedStore: Storefront = {
    id: 'store-123',
    name: 'Kora Home',
    email: 'orders@kora.test',
    phone: '+2348012345678',
    description: null,
    website: 'https://kora.test',
    location: null,
    preferredCourierIds: [],
    createdAt: '2026-09-24T10:00:00.000Z',
    updatedAt: '2026-09-24T10:00:00.000Z',
  };

  beforeEach(async () => {
    savedItems.set([]);
    delivery.states.mockReset();
    delivery.cities.mockReset();
    delivery.states.mockResolvedValue([
      { id: 25, label: 'lagos' },
      { id: 220, label: 'abuja' },
    ]);
    delivery.cities.mockResolvedValue([
      { id: 7, label: 'ikeja' },
      { id: 8, label: 'lekki' },
    ]);
    api = {
      list: vi.fn().mockResolvedValue([]),
      preferredCouriers: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue(connectedStore),
      update: vi.fn(),
      generateKey: vi.fn().mockResolvedValue('demo_secure_key'),
      revealKey: vi.fn(),
      remove: vi.fn(),
    } as unknown as Mocked<StorefrontService>;

    await TestBed.configureTestingModule({
      imports: [StorefrontSettings],
      providers: [
        provideRouter([]),
        { provide: StorefrontService, useValue: api },
        { provide: SendDeliveryService, useValue: delivery },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        { provide: SavedAddressesService, useValue: { items: savedItems.asReadonly() } },
        {
          provide: HapticsService,
          useValue: {
            selection: () => undefined,
            light: () => undefined,
            success: () => undefined,
            error: () => undefined,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StorefrontSettings);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('guides a user with no connected storefronts into setup', () => {
    const content = fixture.nativeElement.textContent as string;

    expect(content).toContain('No Storefronts Yet');
    expect(content).toContain('Add Storefront');
  });

  it('starts a new storefront at the first saved address without marking the form changed', () => {
    savedItems.set([
      { id: 'home', label: 'Home', address: '5 Ahmadu Bello Way', state: 'Lagos', city: 'Ikeja' },
    ]);
    const component = fixture.componentInstance as unknown as StorefrontTestHarness;

    component.openCreate();

    expect(component.form.controls.address.value).toBe('5 Ahmadu Bello Way, Ikeja, Lagos');
    expect(component.selectedAddressId()).toBe('home');
    expect(component.dirty()).toBe(false);
  });

  it('leaves the address empty for a new storefront when nothing is saved', () => {
    const component = fixture.componentInstance as unknown as StorefrontTestHarness;

    component.openCreate();

    expect(component.form.controls.address.value).toBe('');
  });

  describe('dispatch address', () => {
    function fillBasics(component: StorefrontTestHarness): void {
      component.form.patchValue({ name: connectedStore.name, email: connectedStore.email });
      component.phoneNumber.set('8012345678');
    }

    it('sends the state, city and coordinates of a Google address along with its text', async () => {
      const component = fixture.componentInstance as unknown as StorefrontTestHarness;
      component.openCreate();
      fillBasics(component);

      await component.onAddressPlace(lekkiPlace);
      await component.saveStorefront();

      expect(api.create).toHaveBeenCalledWith(
        expect.objectContaining({
          location: {
            address: '12 Admiralty Way, Lekki, Lagos',
            state_id: 25,
            city_id: 8,
            latitude: 6.44,
            longitude: 3.46,
          },
        }),
      );
    });

    it('sends the state and city chosen by hand', async () => {
      const component = fixture.componentInstance as unknown as StorefrontTestHarness;
      component.openCreate();
      fillBasics(component);

      component.toggleAddressManual();
      component.form.controls.address.setValue('5 Ahmadu Bello Way');
      component.onManualState({ id: 25, label: 'lagos' });
      await fixture.whenStable();
      component.onManualCity({ id: 7, label: 'ikeja' });
      await component.saveStorefront();

      expect(api.create).toHaveBeenCalledWith(
        expect.objectContaining({
          location: { address: '5 Ahmadu Bello Way', state_id: 25, city_id: 7 },
        }),
      );
    });

    it('drops the coordinates, but keeps the state and city, when the address is retyped', async () => {
      const component = fixture.componentInstance as unknown as StorefrontTestHarness;
      component.openCreate();
      fillBasics(component);
      await component.onAddressPlace(lekkiPlace);

      (component as unknown as { onAddressTyped(value: string): void }).onAddressTyped(
        '14 Admiralty Way, Lekki, Lagos',
      );
      await component.saveStorefront();

      expect(api.create).toHaveBeenCalledWith(
        expect.objectContaining({
          location: { address: '14 Admiralty Way, Lekki, Lagos', state_id: 25, city_id: 8 },
        }),
      );
    });

    it('sends only the text of a saved address', async () => {
      savedItems.set([
        { id: 'home', label: 'Home', address: '5 Ahmadu Bello Way', state: 'Lagos', city: 'Ikeja' },
      ]);
      const component = fixture.componentInstance as unknown as StorefrontTestHarness;
      component.openCreate();
      fillBasics(component);

      await component.saveStorefront();

      expect(api.create).toHaveBeenCalledWith(
        expect.objectContaining({ location: { address: '5 Ahmadu Bello Way, Ikeja, Lagos' } }),
      );
    });

    it('keeps State and City tucked away until asked, and says where the address resolved to', async () => {
      const component = fixture.componentInstance as unknown as StorefrontTestHarness;
      component.openCreate();
      fillBasics(component);
      component.goToStep2();
      await component.onAddressPlace(lekkiPlace);
      fixture.detectChanges();

      expect(document.body.textContent).toContain('Lekki, Lagos');
      expect(document.body.textContent).toContain('Enter address manually');
      expect(document.querySelector('#storefront-state')).toBeNull();

      component.toggleAddressManual();
      fixture.detectChanges();

      expect(document.querySelector('#storefront-state')).not.toBeNull();
      expect(document.querySelector('#storefront-city')).not.toBeNull();
      expect(document.body.textContent).toContain('Use Google address search');
    });
  });

  it('keeps the modal open with credentials after connecting a storefront', async () => {
    const component = fixture.componentInstance as unknown as StorefrontTestHarness;

    component.openCreate();
    component.form.patchValue({
      name: connectedStore.name,
      email: connectedStore.email,
      website: connectedStore.website ?? '',
    });
    component.phoneNumber.set('8012345678');
    await component.saveStorefront();
    fixture.detectChanges();

    expect(api.create).toHaveBeenCalled();
    expect(api.generateKey).toHaveBeenCalledWith(connectedStore.id);
    expect(document.body.textContent).toContain('Storefront Connected');
    expect(document.body.textContent).toContain('Kora Home Is Ready');
    expect(document.body.textContent).toContain(connectedStore.id);
  });

  it('keeps a connected storefront recoverable when key generation fails', async () => {
    api.generateKey.mockRejectedValue(new Error('Key service unavailable'));
    const component = fixture.componentInstance as unknown as StorefrontTestHarness;

    component.openCreate();
    component.form.patchValue({ name: connectedStore.name, email: connectedStore.email });
    component.phoneNumber.set('8012345678');
    await component.saveStorefront();
    fixture.detectChanges();

    expect(document.body.textContent).toContain('Storefront Connected');
    expect(document.body.textContent).toContain('Try Again');
    expect(document.body.textContent).toContain('Key service unavailable');
  });
});

interface StorefrontTestHarness {
  openCreate(): void;
  saveStorefront(): Promise<void>;
  form: {
    patchValue(value: { name?: string; email?: string; website?: string }): void;
    controls: { address: { value: string; setValue(value: string): void } };
  };
  selectedAddressId(): string | null;
  dirty(): boolean;
  phoneNumber: { set(value: string): void };
  goToStep2(): void;
  onAddressPlace(place: object): Promise<void>;
  toggleAddressManual(): void;
  onManualState(option: { id: number; label: string }): void;
  onManualCity(option: { id: number; label: string }): void;
}

const lekkiPlace = {
  placeId: 'p1',
  street: '12 Admiralty Way',
  formattedAddress: '12 Admiralty Way, Lekki, Lagos',
  state: 'Lagos',
  cityCandidates: ['Lekki'],
  latitude: 6.44,
  longitude: 3.46,
};
