import { afterEach, describe, expect, it, vi } from 'vitest';
import { compressImage } from './compress-image';

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

  it('leaves non-images and gifs untouched', async () => {
    const pdf = fileOf(5_000_000, 'doc.pdf', 'application/pdf');
    const gif = fileOf(5_000_000, 'a.gif', 'image/gif');
    expect(await compressImage(pdf)).toBe(pdf);
    expect(await compressImage(gif)).toBe(gif);
  });

  it('returns the original when the browser cannot decode it', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('unsupported')));
    vi.stubGlobal('OffscreenCanvas', class {});
    const heic = fileOf(3_000_000, 'IMG_1.heic', 'image/heic');
    expect(await compressImage(heic)).toBe(heic);
  });

  it('keeps a small image that already fits', async () => {
    const { close } = stubBrowser(800, 600, 1000);
    const small = fileOf(100_000);
    expect(await compressImage(small)).toBe(small);
    expect(close).toHaveBeenCalled();
  });

  it('scales a large photo down to 1600px on the long edge and re-encodes as JPEG', async () => {
    const { canvases } = stubBrowser(4000, 3000, 300_000);
    const result = await compressImage(fileOf(6_000_000, 'IMG_2.png'));
    expect(canvases[0]).toMatchObject({ width: 1600, height: 1200 });
    expect(result.type).toBe('image/jpeg');
    expect(result.name).toBe('IMG_2.jpg');
    expect(result.size).toBe(300_000);
  });

  it('keeps the original when re-encoding a within-size image would not shrink it', async () => {
    stubBrowser(1200, 900, 900_000);
    const original = fileOf(500_000);
    expect(await compressImage(original)).toBe(original);
  });
});
