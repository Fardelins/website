import { Injectable } from '@angular/core';
import { WebHaptics, type HapticInput, type TriggerOptions } from 'web-haptics';

const PREFERENCE_KEY = 'fardelins-haptics';
const MIN_TRIGGER_GAP_MS = 45;

const HERO_RIPPLE: HapticInput = {
  pattern: [
    { duration: 18, intensity: 0.32 },
    { delay: 52, duration: 26, intensity: 0.58 },
  ],
};

/** Restrained, mobile-only tactile feedback shared by the site's interactions. */
@Injectable({ providedIn: 'root' })
export class HapticsService {
  private readonly haptics = new WebHaptics();
  private lastTriggeredAt = 0;

  trigger(input: HapticInput = 'light', options?: TriggerOptions): void {
    if (!this.canTrigger()) return;

    const now = performance.now();
    if (now - this.lastTriggeredAt < MIN_TRIGGER_GAP_MS) return;
    this.lastTriggeredAt = now;

    // Keep this in the original pointer/click task. WebKit's switch fallback
    // only produces a tap while transient user activation is available.
    void this.haptics.trigger(input, options);
  }

  heroRipple(event: PointerEvent): void {
    if (event.pointerType === 'mouse') return;
    this.trigger(HERO_RIPPLE, { intensity: 0.62 });
  }

  selection(): void {
    this.trigger('selection', { intensity: 0.38 });
  }

  light(): void {
    this.trigger('light', { intensity: 0.42 });
  }

  success(): void {
    this.trigger('success', { intensity: 0.58 });
  }

  error(): void {
    this.trigger('error', { intensity: 0.52 });
  }

  /** Ready for a future visible preference toggle without changing call sites. */
  setEnabled(enabled: boolean): void {
    localStorage.setItem(PREFERENCE_KEY, enabled ? 'on' : 'off');
  }

  private canTrigger(): boolean {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    if (localStorage.getItem(PREFERENCE_KEY) === 'off') return false;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
  }
}
