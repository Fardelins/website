const MAX_EDGE = 1600;
const QUALITY = 0.82;
const DECODE_TIMEOUT_MS = 10_000;
const BE_TYPES = ['image/jpeg', 'image/png'];

/** A photo the browser cannot turn into a JPEG or PNG; the message says what to choose instead. */
export class UnsupportedPhotoError extends Error {}

function kindOf(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  return extension === 'heic' || extension === 'heif' ? 'image/heic' : '';
}

function unsupported(file: File): UnsupportedPhotoError {
  const kind = kindOf(file);
  const label = kind.startsWith('image/') ? kind.slice(6).toUpperCase() : 'This kind of';
  const hint =
    kind === 'image/heic' || kind === 'image/heif'
      ? ' On an iPhone, set Camera > Formats to "Most Compatible" to save JPG photos.'
      : '';
  return new UnsupportedPhotoError(
    `${label} files can't be used here. Choose a JPG or PNG photo.${hint}`,
  );
}

/**
 * Prepares a parcel photo for upload: shrinks big ones to a web-sized JPEG and converts types BE
 * rejects (WebP, GIF). Throws UnsupportedPhotoError when it can't make a JPEG or PNG out of it.
 */
export async function compressImage(file: File): Promise<File> {
  const kind = kindOf(file);
  const acceptedByBe = BE_TYPES.includes(kind);
  if (kind === 'image/svg+xml' || (!kind.startsWith('image/') && kind !== ''))
    throw unsupported(file);

  let source: ImageBitmap | HTMLImageElement;
  let revokeSource: (() => void) | undefined;
  try {
    if (typeof createImageBitmap === 'function') {
      source = await withTimeout(createImageBitmap(file, { imageOrientation: 'from-image' }));
    } else {
      const url = URL.createObjectURL(file);
      revokeSource = () => URL.revokeObjectURL(url);
      source = await withTimeout(loadImage(url));
    }
  } catch {
    revokeSource?.();
    if (acceptedByBe) return file;
    throw unsupported(file);
  }

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas =
      typeof OffscreenCanvas === 'undefined'
        ? document.createElement('canvas')
        : new OffscreenCanvas(width, height);
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d') as
      CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!context) {
      if (acceptedByBe) return file;
      throw unsupported(file);
    }
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(source, 0, 0, width, height);

    const blob =
      typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas
        ? await canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY })
        : await canvasToBlob(canvas as HTMLCanvasElement);
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch (error) {
    if (error instanceof UnsupportedPhotoError) throw error;
    if (acceptedByBe) return file;
    throw unsupported(file);
  } finally {
    if ('close' in source && typeof source.close === 'function') source.close();
    revokeSource?.();
  }
}

/** A photo that never decodes must not hang the upload: it falls back like any decode failure. */
function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Photo decode timed out')), DECODE_TIMEOUT_MS);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Image conversion failed'))),
      'image/jpeg',
      QUALITY,
    );
  });
}
