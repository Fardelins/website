// The login/refresh response shape is undocumented (spec returns a bare 201), everything
// uncertain about the auth contract is quarantined in this file. See docs/customer-app-plan.md 2.7.

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  country?: string;
  avatarUrl?: string;
  emailVerified: boolean;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string | null;
  user: AuthUser | null;
}

export interface RegisterPayload {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  /** Required by the API in international/E.164 format, e.g. +2348012345678. */
  phone: string;
}

export interface RegistrationCountry {
  iso2: string;
  name: string;
}

type Bag = Record<string, unknown>;

const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

/** Unwraps `{ data: {...} }` / `{ result: {...} }` envelopes the API uses inconsistently. */
function unwrap(body: unknown): Bag {
  let node = (body ?? {}) as Bag;
  for (const key of ['data', 'result', 'payload']) {
    const inner = node[key];
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) node = inner as Bag;
  }
  return node;
}

function pick(bag: Bag, keys: string[]): string | undefined {
  for (const key of keys) {
    const found = str(bag[key]);
    if (found) return found;
  }
  return undefined;
}

export function parseUser(source: unknown, missingVerificationFallback = false): AuthUser | null {
  if (!source || typeof source !== 'object') return null;
  const bag = source as Bag;
  const id = pick(bag, ['id', '_id', 'user_id', 'uuid']);
  const email = pick(bag, ['email', 'email_address']);
  if (!id && !email) return null;

  return {
    id: id ?? email!,
    firstName: pick(bag, ['first_name', 'firstName', 'firstname']) ?? '',
    lastName: pick(bag, ['last_name', 'lastName', 'lastname']) ?? '',
    email: email ?? '',
    phone: pick(bag, ['phone', 'phone_number', 'phoneNumber']),
    country: pick(bag, ['country', 'country_name', 'countryName']),
    avatarUrl: pick(bag, ['avatar', 'avatar_url', 'avatarUrl', 'image', 'photo']),
    emailVerified: readVerificationState(bag) ?? missingVerificationFallback,
  };
}

function readVerificationState(bag: Bag): boolean | undefined {
  const value =
    bag['isEmailVerified'] ??
    bag['is_email_verified'] ??
    bag['email_verified'] ??
    bag['emailVerified'] ??
    bag['is_verified'] ??
    bag['verified'] ??
    bag['email_verified_at'] ??
    bag['emailVerifiedAt'];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'false' || normalized === '0' || !normalized) return false;
    return normalized === 'true' || normalized === '1' || !Number.isNaN(Date.parse(value));
  }
  return undefined;
}

/**
 * Normalises a login/refresh response into a session. Tolerates the token arriving under any
 * of the common key names, and a null return means "no token in the body", which is the
 * signal that the API is setting an httpOnly cookie instead.
 */
export function parseSession(body: unknown): AuthSession | null {
  const bag = unwrap(body);
  const accessToken = pick(bag, [
    'access_token',
    'accessToken',
    'token',
    'jwt',
    'id_token',
    'authorization',
  ]);
  if (!accessToken) return null;

  const nested = bag['user'] ?? bag['customer'] ?? bag['account'] ?? bag['profile'];
  return {
    accessToken,
    refreshToken: pick(bag, ['refresh_token', 'refreshToken']) ?? null,
    user: parseUser(nested) ?? parseUser(bag),
  };
}

/**
 * Forgot-password returns a `resetToken` that has to travel through OTP-verify and
 * change-password. The API has been seen returning it two ways: as a bare string directly
 * under `data` (the whole reset JWT, no wrapper object), or nested under a named key,
 * so a bare string envelope is checked before falling back to `unwrap` + key search.
 */
export function parseResetToken(body: unknown): string | null {
  const top = (body ?? {}) as Bag;
  for (const key of ['data', 'result', 'payload']) {
    const value = str(top[key]);
    if (value) return value;
  }
  return pick(unwrap(body), ['resetToken', 'reset_token', 'token']) ?? null;
}

/** Pulls a human-readable message out of a NestJS/class-validator error body. */
export function parseApiError(error: unknown, fallback: string): string {
  // AuthService normalises failed HTTP requests into Error instances before page code receives
  // them. Preserve that useful server message instead of replacing it with a generic fallback.
  if (error instanceof Error && error.message) return sentence(error.message);

  const body = (error as { error?: unknown })?.error;
  const message = (body as Bag)?.['message'];
  if (Array.isArray(message) && message.length) return sentence(String(message[0]));
  if (typeof message === 'string' && message) return sentence(message);
  return fallback;
}

function sentence(text: string): string {
  const trimmed = text.trim();
  const cased = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(cased) ? cased : `${cased}.`;
}
