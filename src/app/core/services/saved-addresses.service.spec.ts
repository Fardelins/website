import { TestBed } from '@angular/core/testing';
import { SavedAddressesService } from './saved-addresses.service';

describe('SavedAddressesService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('keeps each account address book isolated', () => {
    const service = TestBed.inject(SavedAddressesService);

    service.load('customer-a');
    service.add({
      label: 'Home',
      address: '12 Admiralty Way',
      state: 'Lagos',
      city: 'Lekki',
    });

    service.load('customer-b');
    expect(service.items()).toEqual([]);

    service.load('customer-a');
    expect(service.items()).toEqual([
      expect.objectContaining({ label: 'Home', state: 'Lagos', city: 'Lekki' }),
    ]);
  });

  it('removes a saved address from persistent storage', () => {
    const service = TestBed.inject(SavedAddressesService);
    service.load('customer-a');
    const address = service.add({
      label: 'Office',
      address: '4 Marina Road',
      state: 'Lagos',
      city: 'Lagos Island',
    });

    service.remove(address.id);
    service.load('customer-b');
    service.load('customer-a');

    expect(service.items()).toEqual([]);
  });

  it('restores a removed address at its old position', () => {
    const service = TestBed.inject(SavedAddressesService);
    service.load('customer-a');
    const home = service.add({ label: 'Home', address: '1 A Road', state: 'Lagos', city: 'Ikeja' });
    const office = service.add({
      label: 'Office',
      address: '2 B Road',
      state: 'Lagos',
      city: 'Yaba',
    });

    service.remove(home.id);
    service.restore(home, 0);
    service.restore(home, 0);
    service.load('customer-b');
    service.load('customer-a');

    expect(service.items().map((item) => item.id)).toEqual([home.id, office.id]);
  });
});
