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
  ...FEATURE_BACKGROUNDS.flatMap((name) => featureVariants(name, 1600)),
  ...FEATURE_PHONE_MOCKUPS.flatMap((name) => featureVariants(name, 1000, AVIF_UI)),
  ...featureVariants('courier-management-mockup', 1800, AVIF_UI), // wide desktop dashboard
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
  ...[360, 600].flatMap((width) => [
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
  jobs.map(async ({ input, output, width, format, avifQuality = AVIF_PHOTO }) => {
    await mkdir(path.dirname(output), { recursive: true });
    let pipeline = sharp(input).rotate().resize({ width, withoutEnlargement: true });
    pipeline =
      format === 'avif'
        ? pipeline.avif({ quality: avifQuality, effort: 5 })
        : pipeline.webp({ quality: 76, alphaQuality: 82, smartSubsample: true });
    await pipeline.toFile(output);
  }),
);

console.log(`Generated ${jobs.length} optimized image files.`);
