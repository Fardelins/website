/** Hands a downloaded file to the browser as a save, for files fetched with a login header. */
export function saveFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked later so Safari has time to start the save.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
