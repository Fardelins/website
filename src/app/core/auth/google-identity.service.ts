import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { GOOGLE_CLIENT_ID } from '@core/config/google-auth.config';

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

interface GsiCredentialResponse {
  credential: string;
}

interface GsiButtonConfig {
  type: 'standard';
  theme: 'outline' | 'filled_blue' | 'filled_black';
  size: 'large' | 'medium' | 'small';
  shape: 'pill' | 'rectangular';
  text: 'continue_with' | 'signin_with' | 'signup_with';
  logo_alignment: 'left' | 'center';
  width?: number;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (response: GsiCredentialResponse) => void;
          }): void;
          renderButton(parent: HTMLElement, config: GsiButtonConfig): void;
        };
      };
    };
  }
}

/**
 * Wraps Google Identity Services' real "Sign in with Google" button (the full
 * account-chooser popup), deliberately not One Tap, which needs an existing Google
 * session to show anything and suppresses itself for a while after a single cancel.
 * The script loads lazily; only the login/signup pages ever call this.
 */
@Injectable({ providedIn: 'root' })
export class GoogleIdentityService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private scriptLoad: Promise<void> | null = null;
  private initialized = false;
  // The one active listener at a time; renderButton() call order = last page wins.
  private onCredential: ((idToken: string) => void) | null = null;

  /** Renders Google's own button into `container`, sized to its current width. */
  async renderButton(
    container: HTMLElement,
    onCredential: (idToken: string) => void,
  ): Promise<void> {
    if (!this.isBrowser) return;

    await this.loadScript();
    this.onCredential = onCredential;
    this.ensureInitialized();

    const width = Math.round(container.getBoundingClientRect().width);
    window.google!.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      logo_alignment: 'left',
      ...(width > 0 ? { width } : {}),
    });
  }

  private ensureInitialized(): void {
    if (this.initialized) return;
    window.google!.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      // Reads the current listener at call time, so a later renderButton() (e.g. after
      // navigating from login to signup) doesn't need initialize() to run again.
      callback: (response) => this.onCredential?.(response.credential),
    });
    this.initialized = true;
  }

  private loadScript(): Promise<void> {
    if (window.google?.accounts?.id) return Promise.resolve();

    this.scriptLoad ??= new Promise<void>((resolve, reject) => {
      const onError = () =>
        reject(new Error("Google's sign-in script didn't load. Check your connection."));

      const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', onError, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', onError, { once: true });
      document.head.appendChild(script);
    });

    return this.scriptLoad;
  }
}
