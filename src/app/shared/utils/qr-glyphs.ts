export interface QrModule {
  x: number;
  y: number;
  /** Stable 0..1 dither order shared by every visual layer. */
  delay: number;
}

export interface QrFinderPattern {
  x: number;
  y: number;
  delay: number;
}

export interface QrGlyphs {
  size: number;
  span: number;
  modules: QrModule[];
  finders: QrFinderPattern[];
}

export interface BuildQrGlyphsOptions {
  quietZoneModules?: number;
  finderSizeModules?: number;
  /** Square carve-out in the centre for a logo mark. 0 disables the carve-out. */
  logoSizeModules?: number;
  errorCorrection?: 'L' | 'M' | 'Q' | 'H';
}

const DEFAULT_QUIET_ZONE = 2;
const DEFAULT_FINDER_SIZE = 7;
const DEFAULT_LOGO_SIZE = 7;
const FINDER_DELAYS = [0.78, 0.84, 0.81] as const;

/**
 * Builds a dithered, per-module QR layout: same reveal-ready shape used by the QR sign-in
 * plate, shared here so any other QR surface (e.g. the app-promo modal) renders identically.
 */
export async function buildQrGlyphs(
  payload: string,
  options: BuildQrGlyphsOptions = {},
): Promise<QrGlyphs> {
  const quietZone = options.quietZoneModules ?? DEFAULT_QUIET_ZONE;
  const finderSize = options.finderSizeModules ?? DEFAULT_FINDER_SIZE;
  const logoSize = options.logoSizeModules ?? DEFAULT_LOGO_SIZE;

  // Lazy: the encoder is only worth downloading once someone actually sees a QR face.
  const { default: qrcode } = await import('qrcode-generator');
  const qr = qrcode(0, options.errorCorrection ?? 'H');
  qr.addData(payload);
  qr.make();

  const size = qr.getModuleCount();
  const centre = (size - 1) / 2;
  const maxDistance = Math.hypot(centre, centre);
  const modules: QrModule[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!qr.isDark(row, col)) continue;
      if (isFinderModule(row, col, size, finderSize) || isLogoModule(row, col, size, logoSize)) {
        continue;
      }
      const distance = Math.hypot(col - centre, row - centre) / maxDistance;
      modules.push({
        x: col + quietZone,
        y: row + quietZone,
        // Distance shapes the circular wave while noise turns its entire edge into a dither.
        delay: distance * 0.68 + noise2d(row, col) * 0.32,
      });
    }
  }

  const far = quietZone + size - finderSize;
  const finders: QrFinderPattern[] = [
    { x: quietZone, y: quietZone, delay: FINDER_DELAYS[0] },
    { x: far, y: quietZone, delay: FINDER_DELAYS[1] },
    { x: quietZone, y: far, delay: FINDER_DELAYS[2] },
  ];

  return { size, span: size + quietZone * 2, modules, finders };
}

function noise2d(row: number, col: number): number {
  const value = Math.sin((row + 1) * 78.233 + (col + 1) * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function isFinderModule(row: number, col: number, size: number, finderSize: number): boolean {
  const inTop = row < finderSize;
  const inLeft = col < finderSize;
  const inRight = col >= size - finderSize;
  const inBottom = row >= size - finderSize;
  return (inTop && inLeft) || (inTop && inRight) || (inBottom && inLeft);
}

function isLogoModule(row: number, col: number, size: number, logoSize: number): boolean {
  if (!logoSize) return false;
  const start = Math.floor((size - logoSize) / 2);
  const end = start + logoSize;
  return row >= start && row < end && col >= start && col < end;
}
