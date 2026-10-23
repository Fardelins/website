export type QrCardThemeId = 'white' | 'lilac' | 'brand' | 'black';

export interface QrCardTheme {
  id: QrCardThemeId;
  label: string;
  /** Card background, top to bottom. */
  background: readonly [string, string];
  /** The tint of the swirl pattern laid over the background. */
  pattern: string;
  text: string;
  muted: string;
  /** The @username pill. */
  pill: string;
  pillText: string;
  /** The ring around the photo. */
  ring: string;
}

/**
 * The colours the card can wear. They are fixed hex values, not theme tokens, so the card and the
 * image that is shared look the same whichever dashboard theme the person is using. The QR code
 * always sits on a white plate, because scanners read dark modules on a light ground most reliably.
 */
export const QR_CARD_THEMES: readonly QrCardTheme[] = [
  {
    id: 'white',
    label: 'White',
    background: ['#ffffff', '#f4f0fa'],
    pattern: 'rgba(82, 28, 153, 0.07)',
    text: '#14121a',
    muted: '#6b6677',
    pill: '#efe9f8',
    pillText: '#41167a',
    ring: '#e2d8f1',
  },
  {
    id: 'lilac',
    label: 'Lilac',
    background: ['#eadff8', '#d6c6ef'],
    pattern: 'rgba(255, 255, 255, 0.42)',
    text: '#1f0f3a',
    muted: '#5b4883',
    pill: 'rgba(255, 255, 255, 0.72)',
    pillText: '#41167a',
    ring: '#ffffff',
  },
  {
    id: 'brand',
    label: 'Brand',
    background: ['#5a21a8', '#3b1273'],
    pattern: 'rgba(255, 255, 255, 0.1)',
    text: '#ffffff',
    muted: 'rgba(255, 255, 255, 0.74)',
    pill: 'rgba(255, 255, 255, 0.16)',
    pillText: '#ffffff',
    ring: 'rgba(255, 255, 255, 0.92)',
  },
  {
    id: 'black',
    label: 'Black',
    background: ['#1b1b1d', '#09090a'],
    pattern: 'rgba(255, 255, 255, 0.065)',
    text: '#ffffff',
    muted: 'rgba(255, 255, 255, 0.62)',
    pill: 'rgba(255, 255, 255, 0.11)',
    pillText: '#ffffff',
    ring: 'rgba(255, 255, 255, 0.85)',
  },
];

export const DEFAULT_QR_CARD_THEME: QrCardThemeId = 'brand';

export function qrCardTheme(id: string | null | undefined): QrCardTheme {
  return QR_CARD_THEMES.find((theme) => theme.id === id) ?? QR_CARD_THEMES[2];
}

/**
 * The card's layout in a 340 by 510 design space. The on-screen card uses these as pixels and the
 * shared image multiplies them, so the two stay the same card.
 */
export const QR_CARD_LAYOUT = {
  width: 340,
  height: 510,
  radius: 26,
  avatarTop: 28,
  avatarSize: 76,
  avatarRing: 3,
  nameCenterY: 135,
  nameSize: 22,
  nameMaxWidth: 288,
  pillTop: 157,
  pillHeight: 26,
  pillSize: 13,
  plateTop: 199,
  plateSize: 252,
  plateRadius: 22,
  codeSize: 224,
  linkCenterY: 479,
  linkSize: 12.5,
  captionCenterY: 497,
  captionSize: 11,
} as const;

/** What the shared image says under the code. */
export const QR_CARD_CAPTION = 'Scan to find me on Fardelins';

/** The swirl behind everything, one colour on transparent so each card tints it its own way. */
export const QR_CARD_PATTERN_URL = '/app/qr-card-pattern.svg';
