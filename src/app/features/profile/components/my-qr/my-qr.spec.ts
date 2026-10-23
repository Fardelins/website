import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '@core/auth/auth.service';
import type { AuthUser } from '@core/auth/auth.models';
import { HapticsService } from '@core/services/haptics.service';
import { SITE_URL_TOKEN } from '@core/services/seo.service';
import { ToastService } from '@core/services/toast.service';
import { ProfileService } from '../../profile.service';
import { CardImageService } from '../profile-qr-card/card-image.service';
import { MyQr } from './my-qr';

describe('MyQr', () => {
  const user = signal<AuthUser | null>(null);
  const toast = { success: vi.fn(), error: vi.fn() };
  const profile = { updateUsername: vi.fn() };
  const cardImages = { render: vi.fn(), save: vi.fn() };
  const render = cardImages.render;
  let fixture: ComponentFixture<MyQr>;

  const base: AuthUser = {
    id: 'u1',
    firstName: 'Ada',
    lastName: 'Okafor',
    email: 'ada@example.test',
    emailVerified: true,
  };
  const withHandle: AuthUser = { ...base, username: 'adaokafor' };

  async function mount() {
    await TestBed.configureTestingModule({
      imports: [MyQr],
      providers: [
        { provide: AuthService, useValue: { user } },
        { provide: ProfileService, useValue: profile },
        { provide: CardImageService, useValue: cardImages },
        { provide: ToastService, useValue: toast },
        { provide: SITE_URL_TOKEN, useValue: 'https://fardelins.test' },
        {
          provide: HapticsService,
          useValue: {
            light: () => undefined,
            selection: () => undefined,
            success: () => undefined,
            error: () => undefined,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(MyQr);
    fixture.detectChanges();
    await fixture.whenStable();
    // The code is built, then shown after a short skeleton beat.
    await new Promise((resolve) => setTimeout(resolve, 800));
    fixture.detectChanges();
  }

  const root = () => fixture.nativeElement as HTMLElement;
  const shareButton = () => root().querySelector<HTMLButtonElement>('.myqr__share')!;
  const swatches = () => Array.from(root().querySelectorAll<HTMLButtonElement>('.swatch'));

  async function tapShare() {
    shareButton().click();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  beforeEach(() => {
    localStorage.clear();
    toast.success.mockReset();
    toast.error.mockReset();
    profile.updateUsername.mockReset();
    render.mockReset();
    render.mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
    cardImages.save.mockReset();
  });

  afterEach(() => vi.unstubAllGlobals());

  describe('without a username', () => {
    it('asks for one first, and saves it', async () => {
      user.set(base);
      profile.updateUsername.mockResolvedValue(undefined);
      await mount();

      expect(root().textContent).toContain('Choose a username');
      const save = root().querySelector<HTMLButtonElement>('button[type="submit"]')!;
      expect(save.disabled).toBe(true);

      const input = root().querySelector<HTMLInputElement>('input[name="username"]')!;
      input.value = 'ada okafor';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(root().textContent).toContain('2 to 25 letters or numbers');
      expect(save.disabled).toBe(true);

      input.value = 'adaokafor';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(save.disabled).toBe(false);
      root()
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { cancelable: true }));
      await fixture.whenStable();

      expect(profile.updateUsername).toHaveBeenCalledWith('adaokafor');
      expect(toast.success).toHaveBeenCalledWith('Username saved');
    });

    it('shows why a username was refused', async () => {
      user.set(base);
      profile.updateUsername.mockRejectedValue(new Error('Username already taken'));
      await mount();

      const input = root().querySelector<HTMLInputElement>('input[name="username"]')!;
      input.value = 'ada';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      root()
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { cancelable: true }));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(root().textContent).toContain('Username already taken');
    });
  });

  describe('with a username', () => {
    beforeEach(() => user.set(withHandle));

    it('shows the card with the name, handle, link and a code that resolves in', async () => {
      await mount();

      expect(root().textContent).toContain('Ada Okafor');
      expect(root().textContent).toContain('@adaokafor');
      expect(root().textContent).toContain('fardelins.test/u/adaokafor');
      expect(root().textContent).toContain('Scan to find me on Fardelins');
      expect(root().querySelectorAll('.qrp__code--base .qrp__module').length).toBeGreaterThan(100);
      expect(root().querySelectorAll('.qrp__code--base .qrp__finder')).toHaveLength(3);
      expect(root().querySelector('.qrp--revealing')).not.toBeNull();
    });

    it('keeps the privacy note as a hint under the share button', async () => {
      await mount();

      expect(root().querySelector('.myqr__hint')?.textContent).toContain(
        'Anyone who scans it can see your name, photo and @username. Nothing else about you is shared.',
      );
    });

    it('offers four colours, starts on brand, and changes and remembers the choice', async () => {
      await mount();

      expect(swatches().map((swatch) => swatch.getAttribute('aria-label'))).toEqual([
        'White',
        'Lilac',
        'Brand',
        'Black',
      ]);
      const checked = () =>
        swatches().find((swatch) => swatch.getAttribute('aria-checked') === 'true');
      expect(checked()?.getAttribute('aria-label')).toBe('Brand');

      swatches()[0].click();
      fixture.detectChanges();

      expect(checked()?.getAttribute('aria-label')).toBe('White');
      expect(root().querySelector<HTMLElement>('.pcard')?.style.getPropertyValue('--pc-from')).toBe(
        '#ffffff',
      );
      expect(localStorage.getItem('fardelins.qr-card-theme')).toBe('white');
    });

    it('opens on the colour that was saved last time', async () => {
      localStorage.setItem('fardelins.qr-card-theme', 'black');
      await mount();

      const checked = swatches().find((swatch) => swatch.getAttribute('aria-checked') === 'true');
      expect(checked?.getAttribute('aria-label')).toBe('Black');
    });

    it('moves between colours with the arrow keys', async () => {
      await mount();

      root()
        .querySelector('.swatches')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      fixture.detectChanges();

      const checked = swatches().find((swatch) => swatch.getAttribute('aria-checked') === 'true');
      expect(checked?.getAttribute('aria-label')).toBe('Black');
    });

    it('shares the card picture with the link through the share sheet', async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { canShare: () => true, share });
      await mount();
      expect(shareButton().textContent).toContain('Share profile');

      await tapShare();

      const shared = share.mock.calls[0][0] as { files: File[]; text: string; title: string };
      expect(shared.files[0].name).toBe('fardelins-adaokafor.png');
      expect(shared.files[0].type).toBe('image/png');
      expect(shared.text).toContain('https://fardelins.test/u/adaokafor');
      expect(shared.title).toBe('Ada Okafor on Fardelins');
      expect(render.mock.calls.at(-1)?.[0]).toMatchObject({
        handle: 'adaokafor',
        name: 'Ada Okafor',
      });
    });

    it('shares just the link when the browser cannot share files', async () => {
      const share = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { canShare: () => false, share });
      await mount();

      await tapShare();

      expect(share).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://fardelins.test/u/adaokafor' }),
      );
    });

    it('saves the picture and copies the link when there is no share sheet', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { clipboard: { writeText } });
      await mount();

      await tapShare();

      expect(cardImages.save).toHaveBeenCalledWith(expect.any(Blob), 'fardelins-adaokafor.png');
      expect(writeText).toHaveBeenCalledWith('https://fardelins.test/u/adaokafor');
      expect(toast.success).toHaveBeenCalledWith('Card saved and link copied', expect.anything());
    });

    it('says nothing when the share sheet is closed', async () => {
      const closed = Object.assign(new Error('closed'), { name: 'AbortError' });
      vi.stubGlobal('navigator', {
        canShare: () => true,
        share: vi.fn().mockRejectedValue(closed),
      });
      await mount();

      await tapShare();

      expect(toast.error).not.toHaveBeenCalled();
      expect(shareButton().disabled).toBe(false);
    });

    it('offers a retry when the picture cannot be made', async () => {
      vi.stubGlobal('navigator', { canShare: () => true, share: vi.fn() });
      await mount();
      render.mockRejectedValue(new Error('canvas failed'));
      swatches()[1].click();
      fixture.detectChanges();

      await tapShare();

      expect(toast.error).toHaveBeenCalledWith("Couldn't share your card", expect.anything());
      expect(shareButton().disabled).toBe(false);
    });
  });
});
