import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FaqAccordion, FaqItem } from './faq-accordion';

@Component({
  standalone: true,
  imports: [FaqAccordion],
  template: `<app-faq-accordion [items]="items" heading="FAQ Test" />`,
})
class HostComponent {
  items: FaqItem[] = [
    { question: 'Q1', answer: 'A1' },
    { question: 'Q2', answer: 'A2' },
  ];
}

describe('FaqAccordion', () => {
  let fixture: ComponentFixture<HostComponent>;
  let el: HTMLElement;

  const buttons = (): HTMLButtonElement[] =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('.faq__item button'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it('exposes each question as a native, keyboard-operable button with collapsed ARIA state', () => {
    const rendered = buttons();
    expect(rendered.map((b) => b.textContent?.trim())).toEqual(['Q1', 'Q2']);
    rendered.forEach((btn, i) => {
      // Native <button> => Enter/Space activation and focusability come for free.
      expect(btn.tagName).toBe('BUTTON');
      expect(btn.getAttribute('aria-expanded')).toBe('false');
      expect(btn.getAttribute('aria-controls')).toBe(`faq-answer-${i}`);
      expect(el.querySelector(`#faq-answer-${i}`)).not.toBeNull();
    });
  });

  it('opens the activated item and keeps only one open at a time', () => {
    const [first, second] = buttons();

    first.click();
    fixture.detectChanges();
    expect(first.getAttribute('aria-expanded')).toBe('true');
    expect(first.closest('.faq__item')?.classList.contains('faq__item--open')).toBe(true);

    second.click();
    fixture.detectChanges();
    expect(first.getAttribute('aria-expanded')).toBe('false');
    expect(second.getAttribute('aria-expanded')).toBe('true');
  });

  it('collapses the same item when activated twice', () => {
    const [first] = buttons();
    first.click();
    fixture.detectChanges();
    first.click();
    fixture.detectChanges();
    expect(first.getAttribute('aria-expanded')).toBe('false');
  });

  it('labels the region with the heading for assistive tech', () => {
    expect(el.querySelector('#faq-heading')?.textContent).toContain('FAQ Test');
    expect(el.querySelector('section.faq')?.getAttribute('aria-labelledby')).toBe('faq-heading');
  });
});
