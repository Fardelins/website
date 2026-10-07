import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImageCarousel } from './image-carousel';

@Component({
  imports: [ImageCarousel],
  template: `<app-image-carousel [images]="images()" label="Test parcel photo" />`,
})
class Host {
  images = signal<string[]>(['a.webp', 'b.webp', 'c.webp']);
}

describe('ImageCarousel', () => {
  let fixture: ComponentFixture<Host>;
  const el = () => fixture.nativeElement as HTMLElement;
  const stageImage = () => el().querySelector<HTMLImageElement>('.stage__open img')!;
  const click = (selector: string) => {
    el().querySelector<HTMLButtonElement>(selector)!.click();
    fixture.detectChanges();
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('shows the first photo with a thumbnail for each', () => {
    expect(stageImage().getAttribute('src')).toBe('a.webp');
    expect(el().querySelectorAll('.thumb')).toHaveLength(3);
    expect(el().querySelector('.stage .counter')).toBeNull();
  });

  it('moves with the arrows and wraps around at both ends', () => {
    click('.stage .nav--next');
    expect(stageImage().getAttribute('src')).toBe('b.webp');

    click('.stage .nav--prev');
    click('.stage .nav--prev');
    expect(stageImage().getAttribute('src')).toBe('c.webp');

    click('.stage .nav--next');
    expect(stageImage().getAttribute('src')).toBe('a.webp');
  });

  it('jumps to a photo from its thumbnail and marks it current', () => {
    el().querySelectorAll<HTMLButtonElement>('.thumb')[2].click();
    fixture.detectChanges();

    expect(stageImage().getAttribute('src')).toBe('c.webp');
    expect(el().querySelectorAll('.thumb')[2].getAttribute('aria-current')).toBe('true');
  });

  it('hides the arrows and thumbnails for a single photo', () => {
    fixture.componentInstance.images.set(['only.webp']);
    fixture.detectChanges();

    expect(el().querySelector('.stage .nav')).toBeNull();
    expect(el().querySelector('.thumbs')).toBeNull();
    expect(stageImage().getAttribute('src')).toBe('only.webp');
  });

  it('shows an empty state instead of a broken image when there are no photos', () => {
    fixture.componentInstance.images.set([]);
    fixture.detectChanges();

    expect(el().querySelector('.stage__open')).toBeNull();
    expect(el().querySelector('.empty')?.textContent).toContain('No photos added');
  });
});
