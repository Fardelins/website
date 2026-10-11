import { afterEach, describe, expect, it, vi } from 'vitest';
import { UnsupportedPhotoError, compressImage } from './compress-image';

function fileOf(bytes: number, name = 'IMG_1.png', type = 'image/png'): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

function stubBrowser(width: number, height: number, outputBytes: number) {
  const close = vi.fn();
  const canvases: { width: number; height: number }[] = [];
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width, height, close }));
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      constructor(
        public width: number,
        public height: number,
      ) {
        canvases.push(this);
      }
      getContext() {
        return { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' };
      }
      convertToBlob = vi.fn().mockResolvedValue(new Blob([new Uint8Array(outputBytes)]));
    },
  );
  return { close, canvases };
}

describe('compressImage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('refuses things that are not photos, saying what to choose', async () => {
    const pdf = fileOf(5_000, 'doc.pdf', 'application/pdf');
    const svg = fileOf(5_000, 'a.svg', 'image/svg+xml');
    await expect(compressImage(pdf)).rejects.toBeInstanceOf(UnsupportedPhotoError);
    await expect(compressImage(svg)).rejects.toThrow('Choose a JPG or PNG');
  });

  it('keeps a JPEG or PNG the browser cannot decode', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('unsupported')));
    vi.stubGlobal('OffscreenCanvas', class {});
    const jpeg = fileOf(3_000_000, 'IMG_1.jpg', 'image/jpeg');
    expect(await compressImage(jpeg)).toBe(jpeg);
  });

  it('flags a HEIC photo the browser cannot decode and explains the iPhone setting', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('unsupported')));
    vi.stubGlobal('OffscreenCanvas', class {});
    const heic = fileOf(3_000_000, 'IMG_1.heic', 'image/heic');
    await expect(compressImage(heic)).rejects.toThrow(/HEIC files can't be used.*Most Compatible/);
    // Some systems send no type at all for HEIC, so the extension has to say it.
    await expect(compressImage(fileOf(3_000_000, 'IMG_2.HEIC', ''))).rejects.toThrow('HEIC');
  });

  it('refuses a type BE rejects when the browser cannot convert at all', async () => {
    vi.stubGlobal('createImageBitmap', undefined);
    const webp = fileOf(100_000, 'a.webp', 'image/webp');
    await expect(compressImage(webp)).rejects.toThrow('WEBP');
    const png = fileOf(100_000);
    expect(await compressImage(png)).toBe(png);
  });

  it('keeps a small JPEG or PNG that already fits', async () => {
    const { close } = stubBrowser(800, 600, 1000);
    const small = fileOf(100_000);
    expect(await compressImage(small)).toBe(small);
    expect(close).toHaveBeenCalled();
  });

  it('converts a WebP or GIF to JPEG even when it is small, because BE rejects those types', async () => {
    stubBrowser(800, 600, 20_000);
    const webp = await compressImage(fileOf(30_000, 'sticker.webp', 'image/webp'));
    expect(webp.type).toBe('image/jpeg');
    expect(webp.name).toBe('sticker.jpg');
    const gif = await compressImage(fileOf(30_000, 'loop.gif', 'image/gif'));
    expect(gif.type).toBe('image/jpeg');
  });

  it('scales a large photo down to 1600px on the long edge and re-encodes as JPEG', async () => {
    const { canvases } = stubBrowser(4000, 3000, 300_000);
    const result = await compressImage(fileOf(6_000_000, 'IMG_2.png'));
    expect(canvases[0]).toMatchObject({ width: 1600, height: 1200 });
    expect(result.type).toBe('image/jpeg');
    expect(result.name).toBe('IMG_2.jpg');
    expect(result.size).toBe(300_000);
  });

  it('keeps the original when re-encoding a within-size JPEG or PNG would not shrink it', async () => {
    stubBrowser(1200, 900, 900_000);
    const original = fileOf(500_000);
    expect(await compressImage(original)).toBe(original);
  });
});
