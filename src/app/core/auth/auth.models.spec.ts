import { parseApiError, parseResetToken, parseSession, parseUser } from './auth.models';

describe('parseSession', () => {
  it('reads a flat snake_case token payload', () => {
    const session = parseSession({ access_token: 'abc', refresh_token: 'ref' });
    expect(session?.accessToken).toBe('abc');
    expect(session?.refreshToken).toBe('ref');
  });

  it('unwraps a data envelope and camelCase keys', () => {
    const session = parseSession({ data: { accessToken: 'abc', refreshToken: 'ref' } });
    expect(session?.accessToken).toBe('abc');
    expect(session?.refreshToken).toBe('ref');
  });

  it('accepts a bare token key with no refresh token', () => {
    const session = parseSession({ token: 'abc' });
    expect(session?.accessToken).toBe('abc');
    expect(session?.refreshToken).toBeNull();
  });

  it('returns null when no token is present, signalling a cookie-based session', () => {
    expect(parseSession({ message: 'ok', statusCode: 201 })).toBeNull();
  });

  it('picks up a nested user object', () => {
    const session = parseSession({
      access_token: 'abc',
      user: { id: '7', first_name: 'Bami', email: 'bami@example.com', email_verified: true },
    });
    expect(session?.user).toEqual({
      id: '7',
      firstName: 'Bami',
      lastName: '',
      email: 'bami@example.com',
      phone: undefined,
      avatarUrl: undefined,
      emailVerified: true,
    });
  });

  it('falls back to the top level when the user is not nested', () => {
    const session = parseSession({ access_token: 'abc', id: '7', email: 'bami@example.com' });
    expect(session?.user?.email).toBe('bami@example.com');
  });
});

describe('parseUser', () => {
  it('reads the username, and leaves it out when there is none', () => {
    expect(parseUser({ id: '1', email: 'a@b.test', username: 'ada' })?.username).toBe('ada');
    expect(parseUser({ id: '1', email: 'a@b.test' })?.username).toBeUndefined();
  });

  it('rejects an object with neither id nor email', () => {
    expect(parseUser({ first_name: 'Bami' })).toBeNull();
  });

  it('treats a missing verification flag as unverified', () => {
    expect(parseUser({ email: 'a@b.com' })?.emailVerified).toBe(false);
  });

  it('supports an authenticated-profile fallback when the API omits its documented flag', () => {
    expect(parseUser({ email: 'a@b.com' }, true)?.emailVerified).toBe(true);
  });

  it('reads the verification field returned by the customer profile endpoint', () => {
    expect(
      parseUser({
        id: 'f74531a6-7dcc-4bdd-a94c-9d1dacfa3326',
        email: 'product@yopmail.com',
        isEmailVerified: true,
      })?.emailVerified,
    ).toBe(true);
  });

  it('does not mistake a string false value for verified', () => {
    expect(parseUser({ email: 'a@b.com', isEmailVerified: 'false' })?.emailVerified).toBe(false);
  });
});

describe('parseResetToken', () => {
  it('reads a bare JWT string sitting directly under data', () => {
    const body = {
      message: 'Courier_Business updated sucessfully.',
      code: 200,
      data: 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEifQ.sig',
    };
    expect(parseResetToken(body)).toBe('eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEifQ.sig');
  });

  it('reads a flat resetToken', () => {
    expect(parseResetToken({ resetToken: 'abc' })).toBe('abc');
  });

  it('unwraps a data envelope and snake_case key', () => {
    expect(parseResetToken({ data: { reset_token: 'abc' } })).toBe('abc');
  });

  it('returns null when no token-shaped field is present', () => {
    expect(parseResetToken({ message: 'ok' })).toBeNull();
  });
});

describe('parseApiError', () => {
  it('preserves a normalised server error message', () => {
    expect(parseApiError(new Error('Account not found.'), 'fallback')).toBe('Account not found.');
  });

  it('sentence-cases the first message of a validation array', () => {
    const error = { error: { message: ['email must be an email', 'password too short'] } };
    expect(parseApiError(error, 'fallback')).toBe('Email must be an email.');
  });

  it('keeps existing terminal punctuation', () => {
    expect(parseApiError({ error: { message: 'Already taken!' } }, 'fallback')).toBe(
      'Already taken!',
    );
  });

  it('uses the fallback when the body has no message', () => {
    expect(parseApiError({ error: {} }, 'fallback')).toBe('fallback');
  });
});
