import { TestBed } from '@angular/core/testing';
import { TokenStore } from './token-store';

describe('TokenStore', () => {
  let store: TokenStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    store = TestBed.inject(TokenStore);
  });

  it('keeps the access token out of localStorage', () => {
    store.save({ accessToken: 'secret', refreshToken: 'ref', user: null });

    expect(store.token).toBe('secret');
    expect(JSON.stringify(localStorage)).not.toContain('secret');
  });

  it('persists the refresh token so a reload can restore the session', () => {
    store.save({ accessToken: 'secret', refreshToken: 'ref', user: null });
    expect(store.restorable).toBe(true);
    expect(store.refreshToken).toBe('ref');
  });

  it('is not restorable without a refresh token', () => {
    store.save({ accessToken: 'secret', refreshToken: null, user: null });
    expect(store.restorable).toBe(false);
  });

  it('clears every trace on sign out', () => {
    store.save({
      accessToken: 'secret',
      refreshToken: 'ref',
      user: {
        id: '1',
        firstName: 'Bami',
        lastName: 'B',
        email: 'a@b.com',
        emailVerified: true,
      },
    });

    store.clear();

    expect(store.token).toBeNull();
    expect(store.user()).toBeNull();
    expect(store.refreshToken).toBeNull();
  });
});
