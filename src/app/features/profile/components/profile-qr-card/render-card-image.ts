import { QrGlyphs } from '@shared/utils/qr-glyphs';
import {
  QR_CARD_CAPTION,
  QR_CARD_LAYOUT,
  QR_CARD_PATTERN_URL,
  QrCardTheme,
} from './qr-card-themes';

/** Pixel width of the shared picture; the height follows the card's shape. */
const OUTPUT_WIDTH = 1080;
const INK = '#31105b';
const HEADING =
  'Parkinsans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
const BODY = '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
const IMAGE_TIMEOUT_MS = 8000;

export interface CardImageInput {
  theme: QrCardTheme;
  name: string;
  handle: string;
  initials: string;
  avatarUrl: string | null;
  displayLink: string;
  glyphs: QrGlyphs;
}

/**
 * Draws the profile card straight onto a canvas. The picture is built from the same colours and layout
 * numbers as the on-screen card, rather than captured from the page, so it never depends on the page's
 * CSS, fonts or SVG support and comes out identical every time.
 */
export async function renderProfileCardImage(input: CardImageInput): Promise<Blob> {
  const L = QR_CARD_LAYOUT;
  const s = OUTPUT_WIDTH / L.width;
  const width = Math.round(L.width * s);
  const height = Math.round(L.height * s);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the card image.');

  const [avatar, logo, pattern] = await Promise.all([
    input.avatarUrl ? loadImage(input.avatarUrl, true).catch(() => null) : null,
    loadImage('/home/app-icon.svg', false).catch(() => null),
    loadImage(QR_CARD_PATTERN_URL, false).catch(() => null),
    loadFonts(),
  ]);

  drawBackground(ctx, input.theme, pattern, width, height);
  drawAvatar(ctx, input, avatar, width, s);
  drawName(ctx, input, width, s);
  drawHandle(ctx, input, width, s);
  drawPlate(ctx, input, logo, width, s);
  drawFooter(ctx, input, width, s);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The card image could not be made.'))),
      'image/png',
    ),
  );
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  theme: QrCardTheme,
  pattern: HTMLImageElement | null,
  width: number,
  height: number,
): void {
  // CSS linear-gradient(170deg): the line runs mostly downward, a little to the right.
  const gradient = gradientLine(ctx, 170, width, height);
  gradient.addColorStop(0, theme.background[0]);
  gradient.addColorStop(1, theme.background[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  if (!pattern) return;
  // The swirl as a stencil (CSS mask: center / cover): fill its shape with the card's tint, then lay it on.
  const stencil = document.createElement('canvas');
  stencil.width = width;
  stencil.height = height;
  const sctx = stencil.getContext('2d');
  if (!sctx) return;
  const scale = Math.max(width / pattern.naturalWidth, height / pattern.naturalHeight);
  const w = pattern.naturalWidth * scale;
  const h = pattern.naturalHeight * scale;
  sctx.drawImage(pattern, (width - w) / 2, (height - h) / 2, w, h);
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = theme.pattern;
  sctx.fillRect(0, 0, width, height);
  ctx.drawImage(stencil, 0, 0);
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  input: CardImageInput,
  avatar: HTMLImageElement | null,
  width: number,
  s: number,
): void {
  const L = QR_CARD_LAYOUT;
  const radius = (L.avatarSize / 2) * s;
  const cx = width / 2;
  const cy = (L.avatarTop + L.avatarSize / 2) * s;

  ctx.fillStyle = input.theme.ring;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + L.avatarRing * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) {
    const scale = Math.max((radius * 2) / avatar.naturalWidth, (radius * 2) / avatar.naturalHeight);
    const w = avatar.naturalWidth * scale;
    const h = avatar.naturalHeight * scale;
    ctx.drawImage(avatar, cx - w / 2, cy - h / 2, w, h);
  } else {
    ctx.fillStyle = '#efe7fb';
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.fillStyle = '#41167a';
    ctx.font = `700 ${26 * s}px ${HEADING}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(input.initials, cx, cy + s);
  }
  ctx.restore();
}

function drawName(
  ctx: CanvasRenderingContext2D,
  input: CardImageInput,
  width: number,
  s: number,
): void {
  const L = QR_CARD_LAYOUT;
  const maxWidth = L.nameMaxWidth * s;
  let size = L.nameSize * s;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = input.theme.text;
  ctx.font = `700 ${size}px ${HEADING}`;
  while (ctx.measureText(input.name).width > maxWidth && size > L.nameSize * s * 0.6) {
    size -= s * 0.5;
    ctx.font = `700 ${size}px ${HEADING}`;
  }
  let text = input.name;
  while (ctx.measureText(text).width > maxWidth && text.length > 1) text = text.slice(0, -1);
  if (text !== input.name) text = text.trimEnd() + '…';
  ctx.fillText(text, width / 2, L.nameCenterY * s);
}

function drawHandle(
  ctx: CanvasRenderingContext2D,
  input: CardImageInput,
  width: number,
  s: number,
): void {
  const L = QR_CARD_LAYOUT;
  const label = `@${input.handle}`;
  ctx.font = `600 ${L.pillSize * s}px ${BODY}`;
  const textWidth = ctx.measureText(label).width;
  const pillWidth = textWidth + 26 * s;
  const pillHeight = L.pillHeight * s;
  const x = (width - pillWidth) / 2;
  const y = L.pillTop * s;

  ctx.fillStyle = input.theme.pill;
  roundedRect(ctx, x, y, pillWidth, pillHeight, pillHeight / 2);
  ctx.fill();

  ctx.fillStyle = input.theme.pillText;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, width / 2, y + pillHeight / 2 + s * 0.5);
}

function drawPlate(
  ctx: CanvasRenderingContext2D,
  input: CardImageInput,
  logo: HTMLImageElement | null,
  width: number,
  s: number,
): void {
  const L = QR_CARD_LAYOUT;
  const size = L.plateSize * s;
  const x = (width - size) / 2;
  const y = L.plateTop * s;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 22 * s;
  ctx.shadowOffsetY = 10 * s;
  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, x, y, size, size, L.plateRadius * s);
  ctx.fill();
  ctx.restore();

  const glyphs = input.glyphs;
  const code = L.codeSize * s;
  const unit = code / glyphs.span;
  const originX = x + (size - code) / 2;
  const originY = y + (size - code) / 2;

  ctx.fillStyle = INK;
  for (const module of glyphs.modules) {
    roundedRect(
      ctx,
      originX + (module.x + 0.08) * unit,
      originY + (module.y + 0.08) * unit,
      0.84 * unit,
      0.84 * unit,
      0.28 * unit,
    );
    ctx.fill();
  }

  for (const finder of glyphs.finders) {
    const fx = originX + finder.x * unit;
    const fy = originY + finder.y * unit;
    ctx.fillStyle = INK;
    roundedRect(ctx, fx, fy, 7 * unit, 7 * unit, 1.5 * unit);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    roundedRect(ctx, fx + unit, fy + unit, 5 * unit, 5 * unit, unit);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(fx + 3.5 * unit, fy + 3.5 * unit, 1.5 * unit, 0, Math.PI * 2);
    ctx.fill();
  }

  // The carved-out centre: a white tile with the Fardelins mark.
  const tile = 7 * unit;
  const tx = originX + (code - tile) / 2;
  const ty = originY + (code - tile) / 2;
  ctx.fillStyle = '#ffffff';
  roundedRect(ctx, tx, ty, tile, tile, tile * 0.22);
  ctx.fill();
  if (logo) {
    const mark = tile * 0.86;
    ctx.save();
    roundedRect(ctx, tx + (tile - mark) / 2, ty + (tile - mark) / 2, mark, mark, mark * 0.2);
    ctx.clip();
    ctx.drawImage(logo, tx + (tile - mark) / 2, ty + (tile - mark) / 2, mark, mark);
    ctx.restore();
  }
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  input: CardImageInput,
  width: number,
  s: number,
): void {
  const L = QR_CARD_LAYOUT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = input.theme.text;
  ctx.font = `600 ${L.linkSize * s}px ${BODY}`;
  ctx.fillText(input.displayLink, width / 2, L.linkCenterY * s);
  ctx.fillStyle = input.theme.muted;
  ctx.font = `400 ${L.captionSize * s}px ${BODY}`;
  ctx.fillText(QR_CARD_CAPTION, width / 2, L.captionCenterY * s);
}

/** A rounded rectangle path that works in every browser that can draw on a canvas. */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function gradientLine(
  ctx: CanvasRenderingContext2D,
  degrees: number,
  width: number,
  height: number,
): CanvasGradient {
  const dx = Math.sin(rad(degrees));
  const dy = -Math.cos(rad(degrees));
  const length = Math.abs(width * dx) + Math.abs(height * dy);
  const cx = width / 2;
  const cy = height / 2;
  return ctx.createLinearGradient(
    cx - (dx * length) / 2,
    cy - (dy * length) / 2,
    cx + (dx * length) / 2,
    cy + (dy * length) / 2,
  );
}

function rad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

async function loadFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`700 24px Parkinsans`),
      document.fonts.load(`600 14px "DM Sans"`),
      document.fonts.load(`400 12px "DM Sans"`),
    ]);
  } catch {
    // The system fonts in the stacks above still draw the card.
  }
}

function loadImage(url: string, crossOrigin: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) image.crossOrigin = 'anonymous';
    const timer = setTimeout(() => reject(new Error('Image timed out')), IMAGE_TIMEOUT_MS);
    image.onload = () => {
      clearTimeout(timer);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Image failed to load'));
    };
    image.src = url;
  });
}
