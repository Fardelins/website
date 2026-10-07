import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOAST_EXIT_MS, ToastService } from '@core/services/toast.service';
import { Toaster } from './toaster';

const PointerCtor: typeof MouseEvent =
  (globalThis as unknown as { PointerEvent?: typeof MouseEvent }).PointerEvent ?? MouseEvent;

function pointer(type: string, x: number, y: number): MouseEvent {
  return new PointerCtor(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
}

describe('Toaster', () => {
  let fixture: ComponentFixture<Toaster>;
  let service: ToastService;
  let root: HTMLElement;

  const items = () => Array.from(root.querySelectorAll<HTMLElement>('.toast'));
  const titles = () => items().map((el) => el.querySelector('.toast__title')?.textContent?.trim());

  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom has no pointer capture, which the swipe handler relies on.
    HTMLElement.prototype.setPointerCapture = vi.fn();
    service = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(Toaster);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  it('renders a polite live region with no toasts at first', () => {
    const region = root.querySelector('.toaster');
    expect(region?.getAttribute('aria-live')).toBe('polite');
    expect(items()).toHaveLength(0);
  });

  it('shows title, reason and tone, newest first', () => {
    service.success('Profile saved');
    service.error("Couldn't copy", { description: 'Clipboard is blocked.' });
    fixture.detectChanges();

    expect(titles()).toEqual(["Couldn't copy", 'Profile saved']);
    expect(items()[0].classList.contains('toast--error')).toBe(true);
    expect(items()[0].querySelector('.toast__body')?.textContent).toContain(
      'Clipboard is blocked.',
    );
    expect(items()[1].classList.contains('toast--error')).toBe(false);
    expect(items()[1].querySelector('.toast__body')).toBeNull();
  });

  it('lifts the stack above the tab bar when raised', () => {
    expect(root.querySelector('.toaster--raised')).toBeNull();
    fixture.componentRef.setInput('raised', true);
    fixture.detectChanges();
    expect(root.querySelector('.toaster--raised')).not.toBeNull();
  });

  it('marks only the front toast as in front and pushes the rest back', () => {
    service.success('One');
    service.success('Two');
    service.success('Three');
    fixture.detectChanges();

    expect(items().map((el) => el.style.getPropertyValue('--index'))).toEqual(['0', '1', '2']);
    expect(items().map((el) => el.classList.contains('toast--back'))).toEqual([false, true, true]);
  });

  it('dismisses with the close button, fading out before it leaves the DOM', () => {
    service.success('Address saved');
    fixture.detectChanges();

    root.querySelector<HTMLButtonElement>('.toast__close')?.click();
    fixture.detectChanges();
    expect(items()[0].classList.contains('toast--leaving')).toBe(true);

    vi.advanceTimersByTime(TOAST_EXIT_MS);
    fixture.detectChanges();
    expect(items()).toHaveLength(0);
  });

  it('runs an action and then dismisses the toast', () => {
    const undo = vi.fn();
    service.success('Address removed', { actions: [{ label: 'Undo', run: undo }] });
    fixture.detectChanges();

    const button = root.querySelector<HTMLButtonElement>('.toast__action');
    expect(button?.textContent?.trim()).toBe('Undo');
    button?.click();
    fixture.detectChanges();

    expect(undo).toHaveBeenCalledTimes(1);
    expect(items()[0].classList.contains('toast--leaving')).toBe(true);
  });

  it('pauses the countdown on hover and resumes on leave', () => {
    const pause = vi.spyOn(service, 'pause');
    const resume = vi.spyOn(service, 'resume');
    service.success('Copied');
    fixture.detectChanges();

    const region = root.querySelector('.toaster') as HTMLElement;
    region.dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();
    expect(pause).toHaveBeenCalled();
    expect(root.querySelector('.toaster--expanded')).not.toBeNull();

    region.dispatchEvent(new MouseEvent('mouseleave'));
    fixture.detectChanges();
    expect(resume).toHaveBeenCalled();
    expect(root.querySelector('.toaster--expanded')).toBeNull();
  });

  it('pauses while a toast has keyboard focus', () => {
    const pause = vi.spyOn(service, 'pause');
    service.error('Failed');
    fixture.detectChanges();

    root
      .querySelector<HTMLButtonElement>('.toast__close')
      ?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    fixture.detectChanges();
    expect(pause).toHaveBeenCalled();
  });

  it('dismisses on a long swipe', () => {
    service.success('Swipe me');
    fixture.detectChanges();
    const toast = items()[0];

    toast.dispatchEvent(pointer('pointerdown', 0, 0));
    toast.dispatchEvent(pointer('pointermove', 90, 0));
    toast.dispatchEvent(pointer('pointerup', 90, 0));
    fixture.detectChanges();

    expect(items()[0].classList.contains('toast--leaving')).toBe(true);
  });

  it('dismisses on a quick flick that travels only a short way', () => {
    service.success('Flick me');
    fixture.detectChanges();
    const toast = items()[0];
    const now = vi.spyOn(performance, 'now');

    now.mockReturnValue(1000);
    toast.dispatchEvent(pointer('pointerdown', 0, 0));
    toast.dispatchEvent(pointer('pointermove', 30, 0));
    now.mockReturnValue(1050);
    toast.dispatchEvent(pointer('pointerup', 30, 0));
    fixture.detectChanges();

    expect(items()[0].classList.contains('toast--leaving')).toBe(true);
    now.mockRestore();
  });

  it('springs back from a short, slow drag instead of dismissing', () => {
    service.success('Keep me');
    fixture.detectChanges();
    const toast = items()[0];
    const now = vi.spyOn(performance, 'now');

    now.mockReturnValue(1000);
    toast.dispatchEvent(pointer('pointerdown', 0, 0));
    toast.dispatchEvent(pointer('pointermove', 20, 0));
    now.mockReturnValue(3000);
    toast.dispatchEvent(pointer('pointerup', 20, 0));
    fixture.detectChanges();

    expect(items()[0].classList.contains('toast--leaving')).toBe(false);
    expect(toast.style.translate).toBe('');
    now.mockRestore();
  });

  it('ignores a drag that starts on a button, so taps still reach it', () => {
    const run = vi.fn();
    service.success('Tap me', { actions: [{ label: 'Undo', run }] });
    fixture.detectChanges();
    const button = root.querySelector<HTMLButtonElement>('.toast__action') as HTMLButtonElement;

    button.dispatchEvent(pointer('pointerdown', 0, 0));
    button.dispatchEvent(pointer('pointermove', 120, 0));
    button.dispatchEvent(pointer('pointerup', 120, 0));
    fixture.detectChanges();

    expect(items()[0].classList.contains('toast--leaving')).toBe(false);
  });
});
