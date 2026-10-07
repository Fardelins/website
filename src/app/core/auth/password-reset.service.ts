import { Injectable, signal } from '@angular/core';

/** Carries the resetToken from forgot-password's OTP step to /reset-password without a URL param. */
@Injectable({ providedIn: 'root' })
export class PasswordResetService {
  private readonly token = signal<string | null>(null);

  readonly resetToken = this.token.asReadonly();

  set(resetToken: string): void {
    this.token.set(resetToken);
  }

  clear(): void {
    this.token.set(null);
  }
}
