import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { NotFound } from './not-found';
import { routes } from '../../app.routes';

describe('NotFound', () => {
  let fixture: ComponentFixture<NotFound>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotFound],
      providers: [provideRouter(routes)],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(NotFound);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders a helpful fallback page with noindex metadata', async () => {
    await router.navigateByUrl('/missing-page');

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Page not found');
    expect(element.querySelector('a[routerlink="/"]')).toBeTruthy();
  });
});
