import { Routes } from '@angular/router';
import { Home } from './pages/home/home';

// Home is eager — it's the landing route and should paint without an extra
// chunk fetch. Every other page is lazy so it stays out of the initial bundle.
export const routes: Routes = [
  { path: '', component: Home },
  { path: 'home', redirectTo: '', pathMatch: 'full' },
  {
    path: 'contact',
    loadComponent: () => import('./pages/contact/contact').then(({ Contact }) => Contact),
  },
  {
    path: 'blogs',
    loadComponent: () => import('./pages/blogs/blogs').then(({ Blogs }) => Blogs),
  },
  {
    path: 'blogs/:slug',
    loadComponent: () =>
      import('./pages/blog-detail/blog-detail').then(({ BlogDetail }) => BlogDetail),
  },
  {
    path: 'terms',
    loadComponent: () => import('./pages/terms/terms').then(({ Terms }) => Terms),
  },
  {
    path: 'privacy',
    loadComponent: () => import('./pages/privacy/privacy').then(({ Privacy }) => Privacy),
  },
  {
    path: 'features',
    loadComponent: () =>
      import('./pages/features-page/features-page').then(({ FeaturesPage }) => FeaturesPage),
  },
  {
    path: 'download',
    loadComponent: () => import('./pages/download/download').then(({ Download }) => Download),
  },
  {
    path: '404',
    loadComponent: () => import('./pages/not-found/not-found').then(({ NotFound }) => NotFound),
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found').then(({ NotFound }) => NotFound),
  },
];
