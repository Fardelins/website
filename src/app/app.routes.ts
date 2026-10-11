import { Routes } from '@angular/router';
import { authGuard, guestGuard, needsPhoneGuard } from '@core/auth/auth.guard';
import { Home } from './features/home/home';

// Home is eager, it's the landing route and should paint without an extra
// chunk fetch. Every other page is lazy so it stays out of the initial bundle.
export const routes: Routes = [
  { path: '', component: Home },
  { path: 'home', redirectTo: '', pathMatch: 'full' },
  {
    path: 'contact',
    loadComponent: () => import('./features/contact/contact').then(({ Contact }) => Contact),
  },
  {
    path: 'blogs',
    loadComponent: () => import('./features/blog/pages/blogs/blogs').then(({ Blogs }) => Blogs),
  },
  {
    path: 'blogs/:slug',
    loadComponent: () =>
      import('./features/blog/pages/blog-detail/blog-detail').then(({ BlogDetail }) => BlogDetail),
  },
  {
    path: 'terms',
    loadComponent: () => import('./features/legal/terms/terms').then(({ Terms }) => Terms),
  },
  {
    path: 'privacy',
    loadComponent: () => import('./features/legal/privacy/privacy').then(({ Privacy }) => Privacy),
  },
  {
    path: 'features',
    loadComponent: () =>
      import('./features/features-page/features-page').then(({ FeaturesPage }) => FeaturesPage),
  },
  {
    path: 'download',
    loadComponent: () => import('./features/download/download').then(({ Download }) => Download),
  },
  {
    path: 'track',
    loadComponent: () => import('./features/tracking/pages/track/track').then(({ Track }) => Track),
  },
  {
    path: 'track/:trackingId',
    loadComponent: () => import('./features/tracking/pages/track/track').then(({ Track }) => Track),
  },
  {
    path: 'email-verified',
    loadComponent: () =>
      import('./features/email-verified/email-verified').then(({ EmailVerified }) => EmailVerified),
  },
  {
    // Paystack's return URL. Outside /app: the customer may land here with no session restored yet.
    path: 'payment/verify-paystack',
    loadComponent: () =>
      import('./features/payment/pages/payment-return/payment-return').then(
        ({ PaymentReturn }) => PaymentReturn,
      ),
  },
  {
    path: 'email-already-verified',
    redirectTo: () => '/email-verified?status=error&message=Email%20already%20verified',
    pathMatch: 'full',
  },
  {
    // Kept as a redirect: it was the old entry screen and is still linked from the wild.
    path: 'get-started',
    redirectTo: 'signup',
    pathMatch: 'full',
  },
  {
    path: 'signup',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/pages/signup/signup').then(({ Signup }) => Signup),
  },
  {
    path: 'signup/verify',
    loadComponent: () =>
      import('./features/auth/pages/verify-email/verify-email').then(
        ({ VerifyEmail }) => VerifyEmail,
      ),
  },
  {
    path: 'signup/phone',
    canActivate: [needsPhoneGuard],
    loadComponent: () =>
      import('./features/auth/pages/signup-phone/signup-phone').then(
        ({ SignupPhone }) => SignupPhone,
      ),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/pages/login/login').then(({ Login }) => Login),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/pages/forgot-password/forgot-password').then(
        ({ ForgotPassword }) => ForgotPassword,
      ),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/pages/reset-password/reset-password').then(
        ({ ResetPassword }) => ResetPassword,
      ),
  },
  // TEMPORARY: unguarded visual harness for the send card. Remove before commit.
  {
    path: 'preview/send-card',
    loadComponent: () => import('./dev/card-preview').then(({ CardPreview }) => CardPreview),
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./features/app-shell/app-shell').then(({ AppShell }) => AppShell),
    children: [
      {
        path: '',
        loadComponent: () => import('./features/app-home/app-home').then(({ AppHome }) => AppHome),
      },
      {
        path: 'deliveries',
        loadComponent: () =>
          import('./features/deliveries/pages/deliveries-list/deliveries-list').then(
            ({ DeliveriesList }) => DeliveriesList,
          ),
      },
      {
        path: 'deliveries/:trackingId',
        loadComponent: () =>
          import('./features/deliveries/pages/delivery-detail/delivery-detail').then(
            ({ DeliveryDetail }) => DeliveryDetail,
          ),
      },
      {
        path: 'send',
        loadComponent: () =>
          import('./features/send-delivery/pages/send-delivery/send-delivery').then(
            ({ SendDelivery }) => SendDelivery,
          ),
      },
      {
        path: 'send/:orderId/success',
        loadComponent: () =>
          import('./features/send-delivery/pages/order-success/order-success').then(
            ({ OrderSuccess }) => OrderSuccess,
          ),
      },
      // Payments now live on each parcel; keep old links and bookmarks working.
      { path: 'transactions', redirectTo: 'deliveries', pathMatch: 'full' },
      {
        path: 'help',
        loadComponent: () => import('./features/help/pages/help/help').then(({ Help }) => Help),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/pages/profile/profile').then(({ Profile }) => Profile),
      },
      {
        path: 'profile/edit',
        loadComponent: () =>
          import('./features/profile/pages/profile/profile').then(({ Profile }) => Profile),
      },
      {
        path: 'profile/security',
        loadComponent: () =>
          import('./features/profile/pages/profile/profile').then(({ Profile }) => Profile),
      },
      {
        path: 'profile/addresses',
        loadComponent: () =>
          import('./features/profile/pages/profile/profile').then(({ Profile }) => Profile),
      },
      {
        path: 'profile/storefront',
        loadComponent: () =>
          import('./features/profile/pages/profile/profile').then(({ Profile }) => Profile),
      },
      {
        path: 'profile/documents',
        loadComponent: () =>
          import('./features/profile/pages/profile/profile').then(({ Profile }) => Profile),
      },
      {
        path: 'profile/appearance',
        loadComponent: () =>
          import('./features/profile/pages/profile/profile').then(({ Profile }) => Profile),
      },
    ],
  },
  {
    path: '404',
    loadComponent: () => import('./features/not-found/not-found').then(({ NotFound }) => NotFound),
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found').then(({ NotFound }) => NotFound),
  },
];
