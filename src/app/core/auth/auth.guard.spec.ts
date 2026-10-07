import '@angular/compiler';
import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { DEV_USER } from './dev-mock';
import { AuthService } from './auth.service';
import { TokenStore } from './token-store';
import { authGuard, guestGuard } from './auth.guard';

@Component({ template: '' })
class RouteStub {}

describe('authentication guards', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([
          { path: 'app', component: RouteStub, canActivate: [authGuard] },
          { path: 'login', component: RouteStub, canActivate: [guestGuard] },
        ]),
      ],
    });
  });

  it('restores the development login when returning to the app after reload', async () => {
    localStorage.setItem('fardelins.user', JSON.stringify(DEV_USER));
    const router = TestBed.inject(Router);

    expect(await router.navigateByUrl('/app')).toBe(true);
    expect(TestBed.inject(Location).path()).toBe('/app');
  });

  it('settles on login instead of looping when the stored user is stale', async () => {
    localStorage.setItem(
      'fardelins.user',
      JSON.stringify({ ...DEV_USER, id: 'stale-real-user', email: 'stale@example.com' }),
    );
    const router = TestBed.inject(Router);

    expect(await router.navigateByUrl('/app')).toBe(true);
    expect(TestBed.inject(Location).path()).toBe('/login?returnUrl=%2Fapp');
  });
});

describe('authGuard phone requirement', () => {
  const user = signal<{ phone?: string } | null>({ phone: '+2348012345678' });
  const auth = {
    user,
    isAuthenticated: () => true,
    restore: async () => true,
    loadProfile: vi.fn(async (): Promise<void> => undefined),
  };

  async function run(url = '/app'): Promise<boolean | UrlTree> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: TokenStore, useValue: { token: 'token' } },
      ],
    });
    return (await TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    )) as boolean | UrlTree;
  }

  beforeEach(() => {
    auth.loadProfile.mockReset();
    auth.loadProfile.mockResolvedValue(undefined);
    user.set({ phone: '+2348012345678' });
  });

  it('lets a user with a phone straight in, without a server lookup', async () => {
    expect(await run()).toBe(true);
    expect(auth.loadProfile).not.toHaveBeenCalled();
  });

  it('checks the server before sending anyone to add a phone, and lets them in if it has one', async () => {
    user.set({});
    auth.loadProfile.mockImplementation(async () => {
      user.set({ phone: '+2348012345678' });
    });
    expect(await run()).toBe(true);
    expect(auth.loadProfile).toHaveBeenCalledTimes(1);
  });

  it('sends a user with no phone to add one, and back to where they were going', async () => {
    user.set({});
    const result = await run('/app/deliveries');
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(
      '/signup/phone?returnUrl=%2Fapp%2Fdeliveries',
    );
  });

  it('lets someone in when the lookup fails, instead of locking them out', async () => {
    user.set({});
    auth.loadProfile.mockRejectedValue(new Error('offline'));
    expect(await run()).toBe(true);
  });
});
