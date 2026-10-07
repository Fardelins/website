import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

// AVIF quality: 55 is ample for photos and decorative backgrounds. UI
// screenshots (phone/desktop mockups, card panels) carry crisp text and flat
// gradients that soften and band at 55, so they get a higher quality.
const AVIF_PHOTO = 55;
const AVIF_UI = 63;

/** Emit WebP + AVIF (both alpha-capable) for a feature asset at one rendered-appropriate width. */
const featureVariants = (name, width, avifQuality = AVIF_PHOTO) =>
  ['webp', 'avif'].map((format) => ({
    input: `image-sources/features/${name}.png`,
    output: `public/features/${name}-${width}.${format}`,
    width,
    format,
    avifQuality,
  }));

// Widths are ~2x the on-screen render size, not the 2400–6000px originals.
const FEATURE_BACKGROUNDS = [
  'realtime-bg',
  'dispatcher-operations-bg',
  'courier-management-bg',
  'merchant-storefront-bg',
  'delivery-bg',
];
const FEATURE_PHONE_MOCKUPS = [
  'realtime-mockup',
  'dispatcher-operations-mockup',
  'merchant-storefront-mockup',
  'delivery-mockup',
];
const FEATURE_CARDS = [
  'realtime-accepted',
  'realtime-details',
  'realtime-in_transit',
  'dispatcher-operations-order',
  'dispatcher-operations-delivery',
  'dispatcher-operations-active_order',
  'courier-management-admin',
  'courier-management-dispatcher',
  'merchant-storefront-default',
  'merchant-storefront-setup',
  'delivery-proof',
];

const jobs = [
  // Backgrounds and mockups get a second, smaller width so phones don't pull the
  // full-size render (the layered cards stay single-width — they're already small).
  ...FEATURE_BACKGROUNDS.flatMap((name) => [
    ...featureVariants(name, 1600),
    ...featureVariants(name, 800),
  ]),
  ...FEATURE_PHONE_MOCKUPS.flatMap((name) => [
    ...featureVariants(name, 1000, AVIF_UI),
    ...featureVariants(name, 500, AVIF_UI),
  ]),
  ...featureVariants('courier-management-mockup', 1800, AVIF_UI), // wide desktop dashboard
  ...featureVariants('courier-management-mockup', 900, AVIF_UI),
  ...FEATURE_CARDS.flatMap((name) => featureVariants(name, 760, AVIF_UI)),
  ...featureVariants('features-hero-courier', 1600),
  ...[
    'everyday-customer',
    'online-store',
    'retail-business',
    'restaurants-food',
    'courier-companies',
    'dispatch-riders',
  ].flatMap((name) => [
    {
      input: `image-sources/home/${name}.png`,
      output: `public/home/${name}-480.webp`,
      width: 480,
      format: 'webp',
    },
    {
      input: `image-sources/home/${name}.png`,
      output: `public/home/${name}-800.webp`,
      width: 800,
      format: 'webp',
    },
    {
      input: `image-sources/home/${name}.png`,
      output: `public/home/${name}-480.avif`,
      width: 480,
      format: 'avif',
    },
    {
      input: `image-sources/home/${name}.png`,
      output: `public/home/${name}-800.avif`,
      width: 800,
      format: 'avif',
    },
  ]),
  {
    input: 'image-sources/home/footer.jpg',
    output: 'public/home/footer-1920.webp',
    width: 1920,
    format: 'webp',
  },
  {
    input: 'image-sources/home/footer-transparent.png',
    output: 'public/home/footer-transparent-1920.webp',
    width: 1920,
    format: 'webp',
  },
  // Dashboard promo art. Source is 350px, so no upsized variant: the card renders it
  // at half that, which keeps it crisp on 2x without inventing detail.
  ...['webp', 'avif'].map((format) => ({
    input: 'image-sources/app/package-box-wings.png',
    output: `public/app/package-box-wings-350.${format}`,
    width: 350,
    format,
    avifQuality: AVIF_UI,
  })),
  // Generic parcel placeholder for list items (deliveries mock).
  ...['webp', 'avif'].map((format) => ({
    input: 'image-sources/app/parcel-default.png',
    output: `public/app/parcel-default-350.${format}`,
    width: 350,
    format,
    avifQuality: AVIF_UI,
  })),
  // Saved-address card icon, rendered tall (matches label+street block height) — 240 covers 2x at typical card sizes.
  ...['webp', 'avif'].map((format) => ({
    input: 'image-sources/app/location.png',
    output: `public/app/location-240.${format}`,
    width: 240,
    format,
    avifQuality: AVIF_UI,
  })),
  // KYC status icons (pending review / verified / rejected) — small, rendered at ~56px.
  ...['pending-badge', 'verified-badge', 'rejected-badge'].flatMap((name) =>
    ['webp', 'avif'].map((format) => ({
      input: `image-sources/app/${name}.png`,
      output: `public/app/${name}-120.${format}`,
      width: 120,
      format,
      avifQuality: AVIF_UI,
    })),
  ),
  // PDF fallback tile in the document-upload preview, rendered at ~60px.
  ...['webp', 'avif'].map((format) => ({
    input: 'image-sources/app/pdf.png',
    output: `public/app/pdf-120.${format}`,
    width: 120,
    format,
    avifQuality: AVIF_UI,
  })),

  // Auth panel art, one per route. Unsplash originals: glass-stack + glass-spiral by
  // TSD Studio, chrome-ribbon by Nick Levish, horizon by Gabriel Hohenstein. Cropped
  // 3:4 to match the panel's tall column.
  ...['glass-stack', 'glass-spiral', 'chrome-ribbon', 'horizon'].flatMap((name) =>
    [
      { width: 600, height: 800 },
      { width: 900, height: 1200 },
    ].map(({ width, height }) => ({
      input: `image-sources/auth/${name}.jpg`,
      output: `public/auth/${name}-${width}.webp`,
      width,
      height,
      format: 'webp',
    })),
  ),

  // Social-proof avatars. Attention cropping keeps the face in frame at 36px circles;
  // plain centre cropping decapitates several of these portraits.
  ...[1, 2, 3, 4, 5].map((n) => ({
    input: `image-sources/auth/avatar/member-${n}.jpg`,
    output: `public/auth/avatar/member-${n}-96.webp`,
    width: 96,
    height: 96,
    position: 'attention',
    format: 'webp',
  })),
  {
    input: 'image-sources/home/left.png',
    output: 'public/home/left-800.webp',
    width: 800,
    format: 'webp',
  },
  {
    input: 'image-sources/home/right.png',
    output: 'public/home/right-800.webp',
    width: 800,
    format: 'webp',
  },
  {
    input: 'image-sources/contact/image.png',
    output: 'public/contact/image-960.webp',
    width: 960,
    format: 'webp',
  },
  // Rendered up to a 400px CSS slot (hero) — emit 2x/3x widths so it stays
  // crisp on retina/tablet displays instead of upscaling a 600px source.
  ...[480, 800, 1200].flatMap((width) => [
    {
      input: 'image-sources/home/phone-image.png',
      output: `public/home/phone-image-${width}.webp`,
      width,
      format: 'webp',
    },
    {
      input: 'image-sources/home/phone-image.png',
      output: `public/home/phone-image-${width}.avif`,
      width,
      format: 'avif',
      avifQuality: AVIF_UI, // app home screen — crisp UI text
    },
  ]),
  {
    input: 'image-sources/home/details.png',
    output: 'public/home/details-640.webp',
    width: 640,
    format: 'webp',
  },
  {
    input: 'image-sources/home/storefront.png',
    output: 'public/home/storefront-640.webp',
    width: 640,
    format: 'webp',
  },
  {
    input: 'image-sources/home/courier.png',
    output: 'public/home/courier-640.webp',
    width: 640,
    format: 'webp',
  },
  {
    input: 'image-sources/home/customer-phone.png',
    output: 'public/home/customer-phone-600.webp',
    width: 600,
    format: 'webp',
  },
  {
    input: 'image-sources/home/storefront-phone.png',
    output: 'public/home/storefront-phone-600.webp',
    width: 600,
    format: 'webp',
  },
  {
    input: 'image-sources/home/courier-phone.png',
    output: 'public/home/courier-phone-600.webp',
    width: 600,
    format: 'webp',
  },
  {
    input: 'image-sources/blogs/subscribe-banner.png',
    output: 'public/blogs/subscribe-banner-600.webp',
    width: 600,
    format: 'webp',
  },
  {
    input: 'image-sources/blogs/authors/flora.jpg',
    output: 'public/blogs/authors/flora-200.webp',
    width: 200,
    format: 'webp',
  },
  {
    input: 'image-sources/home/logo-white.png',
    output: 'public/home/logo-white-512.webp',
    width: 512,
    format: 'webp',
  },
  {
    input: 'image-sources/home/left-image.png',
    output: 'public/home/left-image-200.webp',
    width: 200,
    format: 'webp',
  },
  {
    input: 'image-sources/home/right-image.png',
    output: 'public/home/right-image-200.webp',
    width: 200,
    format: 'webp',
  },
];

await Promise.all(
  jobs.map(
    async ({
      input,
      output,
      width,
      height,
      format,
      avifQuality = AVIF_PHOTO,
      position = 'centre',
    }) => {
      await mkdir(path.dirname(output), { recursive: true });
      // A height alongside width means "crop to this aspect", so withoutEnlargement is
      // dropped there — it would silently return the uncropped source instead.
      let pipeline = sharp(input)
        .rotate()
        .resize(
          height ? { width, height, fit: 'cover', position } : { width, withoutEnlargement: true },
        );
      pipeline =
        format === 'avif'
          ? pipeline.avif({ quality: avifQuality, effort: 5 })
          : pipeline.webp({ quality: 76, alphaQuality: 82, smartSubsample: true });
      await pipeline.toFile(output);
    },
  ),
);

console.log(`Generated ${jobs.length} optimized image files.`);
