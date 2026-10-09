const MAX_EDGE = 1600;
const QUALITY = 0.82;
const SKIP_BELOW_BYTES = 400 * 1024;

/** Shrinks a phone photo to a web-sized JPEG; returns the original when it can't or needn't. */
export async function compressImage(file: File): Promise<File> {
  if (
    !file.type.startsWith('image/') ||
    file.type === 'image/gif' ||
    file.type === 'image/svg+xml'
  ) {
    return file;
  }
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= SKIP_BELOW_BYTES) return file;

    const canvas = new OffscreenCanvas(
      Math.round(bitmap.width * scale),
      Math.round(bitmap.height * scale),
    );
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: QUALITY });
    if (scale === 1 && blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
