import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, isDevMode } from '@angular/core';
import { firstValueFrom, timeout } from 'rxjs';
import { injectLogisticsApiUrl } from '@core/services/logistics-api.config';
import {
  AuthSession,
  RegisterPayload,
  RegistrationCountry,
  parseApiError,
  parseResetToken,
  parseSession,
  parseUser,
} from './auth.models';
import { DEV_LOGIN_EMAIL, DEV_LOGIN_PASSWORD, DEV_USER } from './dev-mock';
import { TokenStore } from './token-store';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = injectLogisticsApiUrl();
  private readonly store = inject(TokenStore);
  private restoring: Promise<boolean> | null = null;
  private signedOutNotice: string | null = null;
  private currenciesRequest: Promise<ApiCurrency[]> | null = null;

  readonly user = this.store.user;
  readonly isAuthenticated = computed(() => {
    const user = this.store.user();
    if (!user) return false;
    return Boolean(
      this.store.token || this.store.restorable || (isDevMode() && user.id === DEV_USER.id),
    );
  });
  readonly isMockSession = computed(() => this.store.user()?.id === DEV_USER.id);
  readonly displayName = computed(() => {
    const user = this.store.user();
    if (!user) return '';
    return user.firstName || user.email.split('@')[0];
  });

  async login(email: string, password: string): Promise<void> {
    const trimmedEmail = email.trim();
    if (isDevMode() && trimmedEmail === DEV_LOGIN_EMAIL && password === DEV_LOGIN_PASSWORD) {
      this.store.save({ accessToken: 'dev-mock-token', refreshToken: null, user: DEV_USER });
      return;
    }
    const body = await this.post('/auth/login', { email: trimmedEmail, password });
    this.commit(body, 'Login succeeded but no session came back. Contact support.');
  }

  async register(payload: RegisterPayload, country: RegistrationCountry): Promise<void> {
    const currencyId = await this.resolveCurrencyId(country);
    const body = await this.post('/user/register', { ...payload, currency_id: currencyId });
    // Registration may or may not sign you in, a missing token means "go verify your email".
    const session = parseSession(body);
    if (session) this.store.save(session);
  }

  /** `idToken` is the JWT Google Identity Services hands back after account picker. */
  async loginWithGoogle(idToken: string): Promise<void> {
    const body = await this.post('/auth/google-oauth', { token: idToken });
    const session = this.commit(body, 'Google sign-in succeeded but no session came back.');
    if (!session.user) await this.loadProfile();
  }

  resendVerificationEmail(email: string): Promise<unknown> {
    return this.post('/auth/resend-email-verification', { email: email.trim() });
  }

  /** Triggers the OTP email and returns the resetToken that ties the next two steps together. */
  async requestPasswordResetOtp(email: string): Promise<string> {
    const body = await this.post('/auth/forgot-password', { email: email.trim() });
    const resetToken = parseResetToken(body);
    if (!resetToken) throw new Error("We couldn't start the reset. Please try again.");
    return resetToken;
  }

  validateResetOtp(resetToken: string, otp: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(this.apiUrl('/auth/validate-otp'), { resetToken, otp: otp.trim() }),
    );
  }

  changePassword(resetToken: string, password: string): Promise<unknown> {
    return firstValueFrom(
      this.http.patch(this.apiUrl('/auth/change-password'), { resetToken, password }),
    );
  }

  async emailAvailable(email: string): Promise<boolean> {
    try {
      const body = await firstValueFrom(
        this.http.get<Record<string, unknown>>(
          this.apiUrl(`/user/email-available/${encodeURIComponent(email.trim())}`),
        ),
      );
      const value = body?.['available'] ?? body?.['data'] ?? body?.['status'];
      return value !== false;
    } catch {
      // Never block signup on a failed availability probe, the server validates anyway.
      return true;
    }
  }

  /** Exchanges the stored refresh token for a new session. Deduped so parallel 401s share one call. */
  restore(): Promise<boolean> {
    if (isDevMode() && this.store.user()?.id === DEV_USER.id) {
      // Keep what the demo account saved (a username, a photo) across reloads.
      const saved = this.store.user();
      const user = { ...DEV_USER, username: saved?.username, avatarUrl: saved?.avatarUrl };
      this.store.save({ accessToken: 'dev-mock-token', refreshToken: null, user });
      return Promise.resolve(true);
    }
    if (!this.store.restorable) {
      this.store.clear();
      return Promise.resolve(false);
    }
    this.restoring ??= this.performRestore().finally(() => (this.restoring = null));
    return this.restoring;
  }

  async loadProfile(): Promise<void> {
    if (this.isMockSession()) return;

    const body = await firstValueFrom(
      this.http.get(this.apiUrl('/user/me'), {
        params: { _profileRefresh: Date.now().toString() },
      }),
    );
    // The current /user/me omits its documented flag, so a successful authenticated read is the fallback while explicit false still wins.
    const user = parseUser((body as { data?: unknown })?.data ?? body, true);
    if (!user) return;

    const current = this.store.user();
    if (
      current?.id === user.id &&
      current.avatarUrl &&
      cloudinaryVersion(current.avatarUrl) > cloudinaryVersion(user.avatarUrl)
    ) {
      this.store.setUser({ ...user, avatarUrl: current.avatarUrl });
      return;
    }

    this.store.setUser(user);
  }

  /** Why the session ended, shown once on the login page; null for a sign-out the person chose. */
  takeSignedOutNotice(): string | null {
    const notice = this.signedOutNotice;
    this.signedOutNotice = null;
    return notice;
  }

  logout(): Promise<void> {
    const serverLogout = firstValueFrom(
      this.http.get(this.apiUrl('/auth/logout')).pipe(timeout(8_000)),
    ).catch(() => undefined);
    this.store.clear();
    void serverLogout;
    return Promise.resolve();
  }

  private async performRestore(): Promise<boolean> {
    try {
      const body = await firstValueFrom(
        this.http
          .patch(this.apiUrl('/auth/refresh'), {
            refresh_token: this.store.refreshToken,
          })
          .pipe(timeout(10_000)),
      );
      const session = parseSession(body);
      if (!session) return false;
      this.store.save(session);
      if (!session.user) await this.loadProfile();
      return true;
    } catch (error) {
      // BE keeps one session per account: a login elsewhere makes this device's refresh answer 403.
      if (error instanceof HttpErrorResponse && error.status === 403) {
        this.signedOutNotice =
          'You were signed out because your account was opened on another device.';
      } else if (error instanceof HttpErrorResponse && error.status === 401) {
        this.signedOutNotice = 'Your session expired. Please log in again.';
      }
      this.store.clear();
      return false;
    }
  }

  private commit(body: unknown, missingSessionMessage: string): AuthSession {
    const session: AuthSession | null = parseSession(body);
    if (!session) throw new Error(missingSessionMessage);
    this.store.save(session);
    return session;
  }

  private async post(path: string, payload: unknown): Promise<unknown> {
    try {
      return await firstValueFrom(this.http.post(this.apiUrl(path), payload));
    } catch (error) {
      throw new Error(parseApiError(error, 'Something went wrong. Please try again.'));
    }
  }

  private async resolveCurrencyId(country: RegistrationCountry): Promise<number> {
    const currencies = await this.loadCurrencies();
    const preferredCode = CURRENCY_CODE_BY_COUNTRY[country.iso2.toUpperCase()];
    const normalizedCountry = normalizeCountry(country.name);
    const currency =
      (preferredCode ? currencies.find((item) => item.code === preferredCode) : undefined) ??
      currencies.find((item) => normalizeCountry(item.country) === normalizedCountry);

    if (!currency) {
      throw new Error(
        `We couldn't determine the currency for ${country.name}. Please try another country or contact support.`,
      );
    }
    return currency.id;
  }

  private loadCurrencies(): Promise<ApiCurrency[]> {
    this.currenciesRequest ??= firstValueFrom(this.http.get(this.apiUrl('/currency')))
      .then(parseCurrencies)
      .catch((error) => {
        this.currenciesRequest = null;
        throw new Error(
          parseApiError(error, "We couldn't load account settings. Please try again."),
        );
      });
    return this.currenciesRequest;
  }
}

interface ApiCurrency {
  id: number;
  code: string;
  country: string;
}

const CURRENCY_CODE_BY_COUNTRY: Readonly<Record<string, string>> = {
  AD: 'EUR',
  AT: 'EUR',
  BE: 'EUR',
  CY: 'EUR',
  DE: 'EUR',
  EE: 'EUR',
  ES: 'EUR',
  FI: 'EUR',
  FR: 'EUR',
  GR: 'EUR',
  HR: 'EUR',
  IE: 'EUR',
  IT: 'EUR',
  LT: 'EUR',
  LU: 'EUR',
  LV: 'EUR',
  MC: 'EUR',
  ME: 'EUR',
  MT: 'EUR',
  NL: 'EUR',
  PT: 'EUR',
  SI: 'EUR',
  SK: 'EUR',
  SM: 'EUR',
  VA: 'EUR',
  XK: 'EUR',
  BJ: 'XOF',
  BF: 'XOF',
  CI: 'XOF',
  GW: 'XOF',
  ML: 'XOF',
  NE: 'XOF',
  SN: 'XOF',
  TG: 'XOF',
  CM: 'XAF',
  CF: 'XAF',
  TD: 'XAF',
  CG: 'XAF',
  GQ: 'XAF',
  GA: 'XAF',
  AI: 'XCD',
  AG: 'XCD',
  DM: 'XCD',
  GD: 'XCD',
  KN: 'XCD',
  LC: 'XCD',
  MS: 'XCD',
  VC: 'XCD',
  CZ: 'CZK',
  CD: 'CDF',
  TR: 'TRY',
};

function parseCurrencies(body: unknown): ApiCurrency[] {
  const source = (body as { data?: unknown })?.data ?? body;
  if (!Array.isArray(source)) {
    throw new Error("We couldn't load account settings. Please try again.");
  }

  const currencies = source.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const id = Number(record['id']);
    const code = typeof record['code'] === 'string' ? record['code'].toUpperCase() : '';
    const country = typeof record['country'] === 'string' ? record['country'] : '';
    return Number.isFinite(id) && code && country ? [{ id, code, country }] : [];
  });

  if (!currencies.length) {
    throw new Error("We couldn't load account settings. Please try again.");
  }
  return currencies;
}

function normalizeCountry(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^a-z]/gi, '')
    .toLowerCase();
}

function cloudinaryVersion(url?: string): number {
  if (!url) return 0;
  const match = url.match(/\/v(\d+)\//);
  return match ? Number(match[1]) : 0;
}
