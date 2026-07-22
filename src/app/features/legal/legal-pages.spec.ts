import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Privacy } from './privacy/privacy';
import { Terms } from './terms/terms';

describe.each([
  { name: 'Terms', component: Terms, path: '/terms', count: 15 },
  { name: 'Privacy', component: Privacy, path: '/privacy', count: 20 },
])('$name legal-page anchors', ({ component, path, count }) => {
  let fixture: ComponentFixture<unknown>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [component] }).compileComponents();
    fixture = TestBed.createComponent(component as Type<unknown>);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('provides a working anchor for every numbered section', () => {
    const element = fixture.nativeElement as HTMLElement;
    const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('aside nav a'));
    expect(links).toHaveLength(count);
    links.forEach((link, index) => {
      expect(link.getAttribute('href')).toMatch(new RegExp(`^${path}#`));
      expect(link.textContent?.trim()).toMatch(new RegExp(`^${index + 1}\\.`));
      expect(document.querySelector(link.hash)).toBeTruthy();
    });
  });

  it('updates the URL and smoothly scrolls the selected section', () => {
    const element = fixture.nativeElement as HTMLElement;
    const links = element.querySelectorAll<HTMLAnchorElement>('aside nav a');
    const link = links[1];
    const target = document.querySelector<HTMLElement>(link.hash)!;
    const scrollIntoView = vi.fn();
    target.scrollIntoView = scrollIntoView;
    const pushState = vi.spyOn(window.history, 'pushState');

    link.click();
    fixture.detectChanges();

    expect(pushState).toHaveBeenCalledWith(null, '', `${path}${link.hash}`);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(link.getAttribute('aria-current')).toBe('location');
  });
});
