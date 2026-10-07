import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { TokenStore } from './token-store';

/** Gates `/app/*`. Attempts a silent refresh before redirecting so a reload doesn't sign you out. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const store = inject(TokenStore);

  // These routes are client-rendered, so the server pass has no storage to check.
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return false;

  if ((auth.isAuthenticated() && store.token) || (await auth.restore())) {
    return (await hasPhone(auth))
      ? true
      : router.createUrlTree(['/signup/phone'], { queryParams: { returnUrl: state.url } });
  }

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** A phone is required to use the app. The stored user can lag the server, so confirm there before sending anyone to add one. */
async function hasPhone(auth: AuthService): Promise<boolean> {
  if (auth.user()?.phone) return true;
  try {
    await auth.loadProfile();
  } catch {
    return true; // Offline or a server error is not a reason to lock someone out.
  }
  return Boolean(auth.user()?.phone);
}

/** Keeps signed-in users out of the login/signup screens. */
export const guestGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const auth = inject(AuthService);

  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;
  if (auth.isAuthenticated() || (await auth.restore())) return router.createUrlTree(['/app']);

  return true;
};

/** Gates the phone-collection step: signed in but with no phone on file, which only
 * happens after Google sign-in, the password signup form always requires one. */
export const needsPhoneGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const auth = inject(AuthService);

  if (!isPlatformBrowser(inject(PLATFORM_ID))) return false;
  if (!auth.isAuthenticated() && !(await auth.restore())) return router.createUrlTree(['/login']);
  if (auth.user()?.phone) return router.createUrlTree(['/app']);

  return true;
};
