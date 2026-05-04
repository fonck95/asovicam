import { readdir, stat, mkdir } from 'node:fs/promises';
import { join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');
const OPTIMIZED_DIR = join(PUBLIC_DIR, 'optimized');

const SOURCES = ['milpa.jpg', 'steps-milpa.jpg'];
const WIDTHS = [480, 960, 1600, 2400];
const FORMATS = [
  { ext: 'webp', encode: (s) => s.webp({ quality: 78, effort: 5 }) },
  { ext: 'avif', encode: (s) => s.avif({ quality: 55, effort: 4 }) },
];

async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

async function build() {
  await mkdir(OPTIMIZED_DIR, { recursive: true });

  for (const file of SOURCES) {
    const src = join(PUBLIC_DIR, file);
    if (!(await exists(src))) {
      console.warn(`[images] skip ${file} (missing)`);
      continue;
    }
    const { name } = parse(file);
    const meta = await sharp(src).metadata();
    const sourceWidth = meta.width ?? 0;

    for (const w of WIDTHS) {
      if (w > sourceWidth) continue;
      for (const fmt of FORMATS) {
        const out = join(OPTIMIZED_DIR, `${name}-${w}.${fmt.ext}`);
        if (await exists(out)) continue;
        const pipeline = sharp(src).resize({ width: w, withoutEnlargement: true });
        await fmt.encode(pipeline).toFile(out);
        const { size } = await stat(out);
        console.log(`[images] ${name}-${w}.${fmt.ext}  ${(size / 1024).toFixed(1)} KB`);
      }
    }
  }

  console.log(`[images] manifest written to ${OPTIMIZED_DIR}`);
  const list = (await readdir(OPTIMIZED_DIR)).sort();
  for (const f of list) console.log(`  /optimized/${f}`);
}

build().catch((err) => {
  console.error('[images] failed:', err);
  process.exit(1);
});
