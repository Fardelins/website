import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface SavedAddress {
  id: string;
  label: string;
  address: string;
  state: string;
  city: string;
}

const STORAGE_PREFIX = 'fardelins.saved-addresses';

@Injectable({ providedIn: 'root' })
export class SavedAddressesService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly ownerId = signal<string | null>(null);
  private readonly addresses = signal<SavedAddress[]>([]);

  readonly items = this.addresses.asReadonly();
  readonly count = computed(() => this.addresses().length);

  load(ownerId: string): void {
    if (this.ownerId() === ownerId) return;
    this.ownerId.set(ownerId);
    if (!this.isBrowser) return;
    try {
      const raw = localStorage.getItem(this.key(ownerId));
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      this.addresses.set(Array.isArray(parsed) ? parsed.filter(isSavedAddress) : []);
    } catch {
      this.addresses.set([]);
    }
  }

  add(address: Omit<SavedAddress, 'id'>): SavedAddress {
    const saved = { ...address, id: crypto.randomUUID() };
    this.addresses.update((items) => [...items, saved]);
    this.persist();
    return saved;
  }

  update(id: string, address: Omit<SavedAddress, 'id'>): void {
    this.addresses.update((items) =>
      items.map((item) => (item.id === id ? { ...address, id } : item)),
    );
    this.persist();
  }

  /** Puts a removed address back at its old position, for Undo. */
  restore(address: SavedAddress, index: number): void {
    this.addresses.update((items) => {
      if (items.some((item) => item.id === address.id)) return items;
      const next = [...items];
      next.splice(Math.min(index, next.length), 0, address);
      return next;
    });
    this.persist();
  }

  remove(id: string): void {
    this.addresses.update((items) => items.filter((item) => item.id !== id));
    this.persist();
  }

  private persist(): void {
    const ownerId = this.ownerId();
    if (!this.isBrowser || !ownerId) return;
    localStorage.setItem(this.key(ownerId), JSON.stringify(this.addresses()));
  }

  private key(ownerId: string): string {
    return `${STORAGE_PREFIX}.${ownerId}`;
  }
}

function isSavedAddress(value: unknown): value is SavedAddress {
  if (!value || typeof value !== 'object') return false;
  const address = value as Partial<SavedAddress>;
  return Boolean(address.id && address.label && address.address && address.state);
}
