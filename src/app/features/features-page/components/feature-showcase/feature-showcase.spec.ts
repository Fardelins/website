import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FeatureShowcase } from './feature-showcase';

describe('FeatureShowcase', () => {
  let fixture: ComponentFixture<FeatureShowcase>;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({ imports: [FeatureShowcase] }).compileComponents();
    fixture = TestBed.createComponent(FeatureShowcase);
    fixture.componentRef.setInput('sectionId', 'tracking');
    fixture.componentRef.setInput('eyebrow', 'Know where every delivery is.');
    fixture.componentRef.setInput('title', 'Real-Time');
    fixture.componentRef.setInput('accentTitle', 'Tracking');
    fixture.componentRef.setInput('imageSrc', '/features/real-time-tracking.png');
    fixture.componentRef.setInput('imageAlt', 'Delivery tracking preview');
    fixture.componentRef.setInput('items', [
      { title: 'Live tracking', description: 'Track every delivery.' },
      { title: 'Accurate ETAs', description: 'Keep customers informed.' },
    ]);
    fixture.componentRef.setInput('activeIndex', 1);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  it('renders its supplied content and active item', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h2')?.textContent).toContain('Real-Time Tracking');
    expect(element.querySelectorAll('.feature-showcase__item')).toHaveLength(2);
    expect(element.querySelectorAll('.feature-showcase__item-control--active')).toHaveLength(1);
    expect(element.querySelector('.feature-showcase__item-control--active')?.textContent).toContain(
      'Accurate ETAs',
    );
  });

  it('advances to the next item every five seconds', () => {
    vi.advanceTimersByTime(5000);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '.feature-showcase__item-control--active',
      )?.textContent,
    ).toContain('Live tracking');
  });
});
