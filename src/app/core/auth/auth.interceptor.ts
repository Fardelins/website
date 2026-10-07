import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { TokenStore } from './token-store';

const PUBLIC_PATHS = ['/auth/login', '/auth/logout', '/auth/refresh', '/user/register', '/public/'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(TokenStore);
  const auth = inject(AuthService);
  const router = inject(Router);

  const attach = (token: string | null) =>
    token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  const isPublic = PUBLIC_PATHS.some((path) => req.url.includes(path));

  return next(attach(store.token)).pipe(
    catchError((error: unknown) => {
      const unauthorized = error instanceof HttpErrorResponse && error.status === 401;
      if (!unauthorized || isPublic) return throwError(() => error);

      return from(auth.restore()).pipe(
        switchMap((restored) => {
          if (restored) return next(attach(store.token));
          router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
          return throwError(() => error);
        }),
      );
    }),
  );
};
