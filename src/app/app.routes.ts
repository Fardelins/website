import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Contact } from './pages/contact/contact';
import { Blogs } from './pages/blogs/blogs';
import { Terms } from './pages/terms/terms';
import { Privacy } from './pages/privacy/privacy';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'home', redirectTo: '', pathMatch: 'full' },
  { path: 'contact', component: Contact },
  { path: 'blogs', component: Blogs },
  { path: 'terms', component: Terms },
  { path: 'privacy', component: Privacy },
  { path: '**', redirectTo: '' },
];
