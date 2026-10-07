import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'error';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastOptions {
  description?: string;
  actions?: readonly ToastAction[];
  duration?: number;
}

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
  actions: readonly ToastAction[];
  leaving: boolean;
}

interface ToastTimer {
  remaining: number;
  startedAt: number;
  handle: ReturnType<typeof setTimeout> | null;
}

// Errors stay longer because they usually carry a reason worth reading.
const DURATIONS: Record<ToastTone, number> = { success: 4000, error: 7000 };
const MAX_TOASTS = 3;
/** Matches the toaster's exit transition, so a toast leaves the DOM once it has faded. */
export const TOAST_EXIT_MS = 200;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly items = signal<Toast[]>([]);
  private readonly timers = new Map<number, ToastTimer>();
  private paused = false;
  private nextId = 1;

  readonly toasts = this.items.asReadonly();

  success(title: string, options: ToastOptions = {}): number {
    return this.show('success', title, options);
  }

  error(title: string, options: ToastOptions = {}): number {
    return this.show('error', title, options);
  }

  dismiss(id: number): void {
    const toast = this.items().find((item) => item.id === id);
    if (!toast || toast.leaving) return;
    this.clearTimer(id);
    this.items.update((list) =>
      list.map((item) => (item.id === id ? { ...item, leaving: true } : item)),
    );
    setTimeout(
      () => this.items.update((list) => list.filter((item) => item.id !== id)),
      TOAST_EXIT_MS,
    );
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    const now = Date.now();
    for (const timer of this.timers.values()) {
      if (timer.handle) clearTimeout(timer.handle);
      timer.handle = null;
      timer.remaining -= now - timer.startedAt;
    }
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    for (const [id, timer] of this.timers) this.arm(id, timer);
  }

  private show(tone: ToastTone, title: string, options: ToastOptions): number {
    const duration = options.duration ?? DURATIONS[tone];
    // A repeated tap (copy twice) refreshes the existing toast instead of stacking a duplicate.
    const twin = this.items().find(
      (item) => !item.leaving && item.tone === tone && item.title === title,
    );
    if (twin) {
      this.clearTimer(twin.id);
      this.startTimer(twin.id, duration);
      return twin.id;
    }

    const id = this.nextId++;
    this.items.update((list) => [
      ...list,
      {
        id,
        tone,
        title,
        description: options.description,
        actions: options.actions ?? [],
        leaving: false,
      },
    ]);
    this.startTimer(id, duration);

    const live = this.items().filter((item) => !item.leaving);
    if (live.length > MAX_TOASTS) this.dismiss(live[0].id);
    return id;
  }

  private startTimer(id: number, duration: number): void {
    const timer: ToastTimer = { remaining: duration, startedAt: 0, handle: null };
    this.timers.set(id, timer);
    if (!this.paused) this.arm(id, timer);
  }

  private arm(id: number, timer: ToastTimer): void {
    timer.startedAt = Date.now();
    timer.handle = setTimeout(() => this.dismiss(id), Math.max(timer.remaining, 0));
  }

  private clearTimer(id: number): void {
    const timer = this.timers.get(id);
    if (timer?.handle) clearTimeout(timer.handle);
    this.timers.delete(id);
  }
}
