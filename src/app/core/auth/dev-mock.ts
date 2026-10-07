import { AuthUser } from './auth.models';

// BE registration is currently broken for every payload and the login response shape is
// unconfirmed (docs/customer-app-plan.md 2.6, 2.7), this unblocks reviewing the rest of the
// customer-app flow. isDevMode() guards every use, so none of this reaches a production build.
export const DEV_LOGIN_EMAIL = 'dev@fardelins.com';
export const DEV_LOGIN_PASSWORD = 'devpass123';

export const DEV_USER: AuthUser = {
  id: 'dev-user',
  firstName: 'Samuel',
  lastName: 'Jackson',
  email: DEV_LOGIN_EMAIL,
  phone: '+2348012345678',
  emailVerified: true,
};
