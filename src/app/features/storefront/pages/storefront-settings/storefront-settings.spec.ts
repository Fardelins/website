import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Mocked, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import { HapticsService } from '@core/services/haptics.service';
import { SavedAddressesService } from '@core/services/saved-addresses.service';
import { Storefront } from '../../storefront.models';
import { StorefrontService } from '../../storefront.service';
import { StorefrontSettings } from './storefront-settings';

describe('StorefrontSettings', () => {
  let fixture: ComponentFixture<StorefrontSettings>;
  let api: Mocked<StorefrontService>;

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
        { provide: StorefrontService, useValue: api },
        { provide: AuthService, useValue: { user: signal(null).asReadonly() } },
        { provide: SavedAddressesService, useValue: { items: signal([]).asReadonly() } },
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
  };
  phoneNumber: { set(value: string): void };
}
