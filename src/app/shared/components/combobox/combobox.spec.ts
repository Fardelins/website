import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Combobox } from './combobox';

describe('Combobox', () => {
  let fixture: ComponentFixture<Combobox>;
  const selected = vi.fn();

  beforeEach(async () => {
    selected.mockClear();
    await TestBed.configureTestingModule({ imports: [Combobox] }).compileComponents();
    fixture = TestBed.createComponent(Combobox);
    fixture.componentRef.setInput('options', [{ id: 1, label: 'abuja' }]);
    fixture.componentRef.setInput('value', 'abuja');
    fixture.componentRef.setInput('strict', true);
    fixture.componentInstance.selected.subscribe(selected);
    fixture.detectChanges();
    await fixture.whenStable();
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  const blur = () => fixture.nativeElement.querySelector('input').dispatchEvent(new Event('blur'));

  it('confirms a typed value that matches an option when the field loses focus', () => {
    blur();
    vi.advanceTimersByTime(10);
    expect(selected).toHaveBeenCalledWith({ id: 1, label: 'abuja' });
  });

  it('does not emit after the field is gone (Angular NG0953)', () => {
    blur();
    fixture.destroy();
    vi.advanceTimersByTime(10);
    expect(selected).not.toHaveBeenCalled();
  });
});
