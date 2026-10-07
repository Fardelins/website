import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { HapticsService } from '@core/services/haptics.service';

export type OtpStatus = 'idle' | 'checking' | 'success' | 'error';

// Matches email-verified's content-shake exactly, so a wrong code reads the same way
// a broken verification link does elsewhere in the auth flow.
const SHAKE_MS = 550;

@Component({
  selector: 'app-otp-input',
  templateUrl: './otp-input.html',
  styleUrl: './otp-input.css',
})
export class OtpInput {
  readonly length = input.required<number>();
  /** Drives the box grid's own feedback, checking dims it, error shakes it, success pops it green. */
  readonly status = input<OtpStatus>('idle');
  /** Fires once every box is filled, with the assembled code. */
  readonly complete = output<string>();

  private readonly haptics = inject(HapticsService);
  private readonly boxes = viewChildren<ElementRef<HTMLInputElement>>('box');

  protected readonly slots = computed(() => Array.from({ length: this.length() }, (_, i) => i));
  protected readonly digits = signal<string[]>([]);
  protected readonly shaking = signal(false);
  readonly code = computed(() => this.padded().join(''));

  constructor() {
    effect(() => this.onStatusChange(this.status()));
  }

  /** Clears every box and refocuses the first one. */
  reset(): void {
    this.digits.set(Array(this.length()).fill(''));
    this.syncBoxes();
    this.focusBox(0);
  }

  protected onInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '');
    const size = this.length();
    const next = this.padded();

    if (value.length > 1) {
      const chars = value.slice(0, size - index).split('');
      chars.forEach((char, offset) => (next[index + offset] = char));
      this.digits.set(next);
      this.syncBoxes();
      chars.forEach((_, offset) => this.pop(index + offset, offset));
      this.focusBox(Math.min(index + chars.length, size - 1));
      this.submitIfComplete();
      return;
    }

    next[index] = value;
    this.digits.set(next);
    input.value = value;
    if (value) {
      this.haptics.selection();
      this.pop(index, 0);
      this.focusBox(index + 1);
    }
    this.submitIfComplete();
  }

  protected onKeydown(index: number, event: KeyboardEvent): void {
    if (event.key !== 'Backspace' || this.padded()[index]) return;
    event.preventDefault();
    const next = this.padded();
    next[Math.max(index - 1, 0)] = '';
    this.digits.set(next);
    this.syncBoxes();
    this.focusBox(index - 1);
  }

  private padded(): string[] {
    const current = this.digits();
    return Array.from({ length: this.length() }, (_, i) => current[i] ?? '');
  }

  private submitIfComplete(): void {
    const code = this.padded();
    if (code.length === this.length() && code.every(Boolean)) this.complete.emit(code.join(''));
  }

  private syncBoxes(): void {
    const current = this.padded();
    this.boxes().forEach((box, index) => (box.nativeElement.value = current[index] ?? ''));
  }

  private focusBox(index: number): void {
    this.boxes()[Math.max(0, Math.min(index, this.length() - 1))]?.nativeElement.focus();
  }

  private onStatusChange(status: OtpStatus): void {
    if (status === 'error') {
      this.haptics.error();
      this.shaking.set(false);
      void Promise.resolve().then(() => this.shaking.set(true));
      setTimeout(() => {
        this.shaking.set(false);
        this.reset();
      }, SHAKE_MS);
    } else if (status === 'success') {
      this.haptics.success();
      this.boxes().forEach((_, index) => this.pop(index, index));
    }
  }

  // Force-reflow restart so the pop animation replays even if the same box already ran it, 
  // a paste cascades this across boxes with a staggered delay via the `--i` custom property.
  private pop(index: number, stagger: number): void {
    const el = this.boxes()[index]?.nativeElement;
    if (!el) return;
    el.style.setProperty('--i', String(stagger));
    el.classList.remove('otp__box--pop');
    void el.offsetWidth;
    el.classList.add('otp__box--pop');
  }
}
