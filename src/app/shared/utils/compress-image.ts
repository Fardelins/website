const MAX_EDGE = 1600;
const QUALITY = 0.82;
const SKIP_BELOW_BYTES = 400 * 1024;
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
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') {
    if (acceptedByBe) return file;
    throw unsupported(file);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    if (acceptedByBe) return file;
    throw unsupported(file);
  }

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (acceptedByBe && scale === 1 && file.size <= SKIP_BELOW_BYTES) return file;

    const canvas = new OffscreenCanvas(
      Math.round(bitmap.width * scale),
      Math.round(bitmap.height * scale),
    );
    const context = canvas.getContext('2d');
    if (!context) {
      if (acceptedByBe) return file;
      throw unsupported(file);
    }
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY });
    if (acceptedByBe && scale === 1 && blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch (error) {
    if (error instanceof UnsupportedPhotoError) throw error;
    if (acceptedByBe) return file;
    throw unsupported(file);
  } finally {
    bitmap.close();
  }
}
