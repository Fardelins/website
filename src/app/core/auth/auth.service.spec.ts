import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { DEV_LOGIN_EMAIL, DEV_LOGIN_PASSWORD, DEV_USER } from './dev-mock';
import { TokenStore } from './token-store';

const configure = (): void => {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
};

describe('AuthService session restoration', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('restores the development session after a page reload', async () => {
    configure();
    await TestBed.inject(AuthService).login(DEV_LOGIN_EMAIL, DEV_LOGIN_PASSWORD);

    TestBed.resetTestingModule();
    configure();
    const reloadedAuth = TestBed.inject(AuthService);
    const reloadedStore = TestBed.inject(TokenStore);

    expect(reloadedStore.token).toBeNull();
    expect(reloadedAuth.isAuthenticated()).toBe(true);
    await expect(reloadedAuth.restore()).resolves.toBe(true);
    expect(reloadedStore.token).toBe('dev-mock-token');
  });

  it('clears a stale user that has no usable session', async () => {
    localStorage.setItem(
      'fardelins.user',
      JSON.stringify({
        ...DEV_USER,
        id: 'stale-real-user',
        email: 'stale@example.com',
      }),
    );
    configure();
    const auth = TestBed.inject(AuthService);
    const store = TestBed.inject(TokenStore);

    expect(auth.isAuthenticated()).toBe(false);
    await expect(auth.restore()).resolves.toBe(false);
    expect(store.user()).toBeNull();
    expect(localStorage.getItem('fardelins.user')).toBeNull();
  });

  it('clears the local session without waiting for the logout request', async () => {
    configure();
    const auth = TestBed.inject(AuthService);
    const store = TestBed.inject(TokenStore);
    const http = TestBed.inject(HttpTestingController);
    await auth.login(DEV_LOGIN_EMAIL, DEV_LOGIN_PASSWORD);

    const completed = auth.logout();

    expect(store.user()).toBeNull();
    expect(store.token).toBeNull();
    http.expectOne('/v1/auth/logout').flush({ success: true });
    await expect(completed).resolves.toBeUndefined();
    http.verify();
  });
});

describe('AuthService registration', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    configure();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('resolves the sender currency and creates a real account in development', async () => {
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const registration = auth.register(
      {
        first_name: 'Bami',
        last_name: 'Sender',
        email: 'bami@example.com',
        password: 'Strong!Pass2026',
        phone: '+2348012345678',
      },
      { iso2: 'NG', name: 'Nigeria' },
    );

    http.expectOne('/v1/currency').flush({
      data: [{ id: 98, code: 'NGN', country: 'Nigeria' }],
    });
    await nextTask();
    const request = http.expectOne('/v1/user/register');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      first_name: 'Bami',
      last_name: 'Sender',
      email: 'bami@example.com',
      password: 'Strong!Pass2026',
      phone: '+2348012345678',
      currency_id: 98,
    });
    request.flush({ message: 'User created successfully.', code: 201 });

    await expect(registration).resolves.toBeUndefined();
  });

  it('uses the shared Euro currency for a Eurozone sender', async () => {
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const registration = auth.register(
      {
        first_name: 'Ada',
        last_name: 'Sender',
        email: 'ada@example.com',
        password: 'Strong!Pass2026',
        phone: '+33123456789',
      },
      { iso2: 'FR', name: 'France' },
    );

    http.expectOne('/v1/currency').flush({
      data: [{ id: 43, code: 'EUR', country: 'European Union' }],
    });
    await nextTask();
    const request = http.expectOne('/v1/user/register');
    expect(request.request.body.currency_id).toBe(43);
    request.flush({ message: 'User created successfully.', code: 201 });

    await expect(registration).resolves.toBeUndefined();
  });

  it('shows the API registration error instead of pretending signup succeeded', async () => {
    const auth = TestBed.inject(AuthService);
    const http = TestBed.inject(HttpTestingController);
    const registration = auth.register(
      {
        first_name: 'Bami',
        last_name: 'Sender',
        email: 'taken@example.com',
        password: 'Strong!Pass2026',
        phone: '+2348012345678',
      },
      { iso2: 'NG', name: 'Nigeria' },
    );

    http.expectOne('/v1/currency').flush({
      data: [{ id: 98, code: 'NGN', country: 'Nigeria' }],
    });
    await nextTask();
    http
      .expectOne('/v1/user/register')
      .flush(
        { message: 'Email already exists', statusCode: 409 },
        { status: 409, statusText: 'Conflict' },
      );

    await expect(registration).rejects.toThrow('Email already exists.');
  });
});

function nextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
