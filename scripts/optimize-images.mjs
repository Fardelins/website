import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const jobs = [
  ...['everyday-customer', 'online-store', 'retail-business', 'restaurants-food', 'courier-companies', 'dispatch-riders'].flatMap((name) => [
    { input: `image-sources/home/${name}.png`, output: `public/home/${name}-480.webp`, width: 480, format: 'webp' },
    { input: `image-sources/home/${name}.png`, output: `public/home/${name}-800.webp`, width: 800, format: 'webp' },
    { input: `image-sources/home/${name}.png`, output: `public/home/${name}-480.avif`, width: 480, format: 'avif' },
    { input: `image-sources/home/${name}.png`, output: `public/home/${name}-800.avif`, width: 800, format: 'avif' },
  ]),
  { input: 'image-sources/home/footer.jpg', output: 'public/home/footer-1920.webp', width: 1920, format: 'webp' },
  { input: 'image-sources/home/footer-transparent.png', output: 'public/home/footer-transparent-1920.webp', width: 1920, format: 'webp' },
  { input: 'image-sources/home/left.png', output: 'public/home/left-800.webp', width: 800, format: 'webp' },
  { input: 'image-sources/home/right.png', output: 'public/home/right-800.webp', width: 800, format: 'webp' },
  { input: 'image-sources/contact/image.png', output: 'public/contact/image-960.webp', width: 960, format: 'webp' },
  ...[360, 600].flatMap((width) => [
    { input: 'image-sources/home/phone-image.png', output: `public/home/phone-image-${width}.webp`, width, format: 'webp' },
    { input: 'image-sources/home/phone-image.png', output: `public/home/phone-image-${width}.avif`, width, format: 'avif' },
  ]),
  { input: 'image-sources/home/details.png', output: 'public/home/details-640.webp', width: 640, format: 'webp' },
  { input: 'image-sources/home/storefront.png', output: 'public/home/storefront-640.webp', width: 640, format: 'webp' },
  { input: 'image-sources/home/courier.png', output: 'public/home/courier-640.webp', width: 640, format: 'webp' },
  { input: 'image-sources/home/customer-phone.png', output: 'public/home/customer-phone-600.webp', width: 600, format: 'webp' },
  { input: 'image-sources/home/storefront-phone.png', output: 'public/home/storefront-phone-600.webp', width: 600, format: 'webp' },
  { input: 'image-sources/home/courier-phone.png', output: 'public/home/courier-phone-600.webp', width: 600, format: 'webp' },
  { input: 'image-sources/blogs/subscribe-banner.png', output: 'public/blogs/subscribe-banner-600.webp', width: 600, format: 'webp' },
  { input: 'image-sources/home/logo-white.png', output: 'public/home/logo-white-512.webp', width: 512, format: 'webp' },
  { input: 'image-sources/home/left-image.png', output: 'public/home/left-image-200.webp', width: 200, format: 'webp' },
  { input: 'image-sources/home/right-image.png', output: 'public/home/right-image-200.webp', width: 200, format: 'webp' },
];

await Promise.all(jobs.map(async ({ input, output, width, format }) => {
  await mkdir(path.dirname(output), { recursive: true });
  let pipeline = sharp(input).rotate().resize({ width, withoutEnlargement: true });
  pipeline = format === 'avif'
    ? pipeline.avif({ quality: 55, effort: 5 })
    : pipeline.webp({ quality: 76, alphaQuality: 82, smartSubsample: true });
  await pipeline.toFile(output);
}));

console.log(`Generated ${jobs.length} optimized image files.`);
