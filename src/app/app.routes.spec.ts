import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { routes } from './app.routes';

describe('application routing', () => {
  let router: Router;
  let location: Location;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
  });

  it.each(['/contact', '/blogs', '/terms', '/privacy', '/download'])(
    'recognizes the %s route',
    async (url) => {
      expect(await router.navigateByUrl(url)).toBe(true);
      expect(location.path()).toBe(url);
    },
  );

  it('redirects legacy and unknown URLs to home', async () => {
    await router.navigateByUrl('/home');
    expect(location.path()).toBe('');

    await router.navigateByUrl('/missing-page');
    expect(location.path()).toBe('');
  });

  it('preserves blog-detail slugs', async () => {
    await router.navigateByUrl('/blogs/a-delivery-story');
    expect(location.path()).toBe('/blogs/a-delivery-story');
  });
});
