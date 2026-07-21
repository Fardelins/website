// Fetches the woff2 binaries into public/fonts (the @font-face rules live in
// src/styles.css). Variable fonts → one file per style+subset. Run: npm run generate:fonts
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const FONTS_DIR = 'public/fonts';
// Modern desktop Chrome UA so Google returns woff2 (and only latin/latin-ext).
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const CSS_URL =
  'https://fonts.googleapis.com/css2?family=Parkinsans:wght@400;500;600;700;800' +
  '&family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400&display=swap';

const curl = (args) => execFileSync('curl', ['-sfL', '-A', UA, ...args], { encoding: 'buffer' });

await mkdir(FONTS_DIR, { recursive: true });
const css = curl([CSS_URL]).toString('utf8');

const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)];
if (blocks.length === 0) throw new Error('No @font-face blocks parsed from Google Fonts CSS.');

const field = (block, name) =>
  (block.match(new RegExp(`${name}:\\s*([^;]+);`)) || [, ''])[1].trim();

const seen = new Map(); // remote url -> local filename (dedupes the variable-font files)
for (const [, subset, block] of blocks) {
  const url = block.match(/url\(([^)]+)\)/)[1];
  if (seen.has(url)) continue;
  const slug = field(block, 'font-family').replace(/['"]/g, '').toLowerCase().replace(/\s+/g, '-');
  const styleTag = field(block, 'font-style') === 'italic' ? '-italic' : '';
  const filename = `${slug}${styleTag}-${subset}.woff2`;
  await writeFile(path.join(FONTS_DIR, filename), curl([url]));
  seen.set(url, filename);
}

console.log(`Downloaded ${seen.size} woff2 files to ${FONTS_DIR}/:`);
console.log(
  [...seen.values()]
    .sort()
    .map((f) => `  ${f}`)
    .join('\n'),
);
