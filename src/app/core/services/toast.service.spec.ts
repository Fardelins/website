import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOAST_EXIT_MS, ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = TestBed.inject(ToastService);
  });

  afterEach(() => vi.useRealTimers());

  it('shows a toast and removes it after its duration and exit', () => {
    service.success('Profile saved');
    expect(service.toasts().map((t) => t.title)).toEqual(['Profile saved']);

    vi.advanceTimersByTime(4000);
    expect(service.toasts()[0].leaving).toBe(true);
    vi.advanceTimersByTime(TOAST_EXIT_MS);
    expect(service.toasts()).toEqual([]);
  });

  it('keeps errors longer than successes', () => {
    service.error("Couldn't copy");
    vi.advanceTimersByTime(4000);
    expect(service.toasts()[0].leaving).toBe(false);
    vi.advanceTimersByTime(3000);
    expect(service.toasts()[0].leaving).toBe(true);
  });

  it('refreshes a repeated toast instead of stacking a duplicate', () => {
    service.success('API key copied');
    vi.advanceTimersByTime(3000);
    service.success('API key copied');
    expect(service.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(3000);
    expect(service.toasts()[0].leaving).toBe(false);
  });

  it('keeps at most three live toasts, dismissing the oldest', () => {
    ['One', 'Two', 'Three', 'Four'].forEach((title) => service.success(title));
    const live = service
      .toasts()
      .filter((t) => !t.leaving)
      .map((t) => t.title);
    expect(live).toEqual(['Two', 'Three', 'Four']);
  });

  it('pauses timers and resumes with the time that was left', () => {
    service.success('Address saved');
    vi.advanceTimersByTime(3000);
    service.pause();
    vi.advanceTimersByTime(10_000);
    expect(service.toasts()[0].leaving).toBe(false);

    service.resume();
    vi.advanceTimersByTime(999);
    expect(service.toasts()[0].leaving).toBe(false);
    vi.advanceTimersByTime(1);
    expect(service.toasts()[0].leaving).toBe(true);
  });

  it('dismisses on demand', () => {
    const id = service.error('Failed');
    service.dismiss(id);
    vi.advanceTimersByTime(TOAST_EXIT_MS);
    expect(service.toasts()).toEqual([]);
  });
});
