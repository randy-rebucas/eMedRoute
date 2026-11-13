// Crop, resize and tone down a stock photo for the rep app, writing assets/photos/<name>.jpg.
// Usage (from the repo root):
//   node .claude/skills/rep-redesign/scripts/process-photo.mjs <src.jpg> <name> <width> <height> [position]
// position: centre (default), top, bottom, left, right, or a sharp gravity like "north east".
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const sharp = createRequire(path.join(repo, 'package.json'))('sharp');

const [src, name, w, h, position = 'centre'] = process.argv.slice(2);
if (!src || !name || !w || !h || !/^[a-z0-9-]+$/.test(name)) {
  console.error('usage: process-photo.mjs <src.jpg> <kebab-name> <width> <height> [position]');
  process.exit(1);
}

const out = path.join(repo, 'assets', 'photos', `${name}.jpg`);
const info = await sharp(src)
  .resize(Number(w), Number(h), { fit: 'cover', position })
  .modulate({ saturation: 0.8 })
  .jpeg({ quality: 74, mozjpeg: true })
  .toFile(out);

console.log(`${path.relative(repo, out)}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(1)} KB`);
if (info.size > 60 * 1024) console.warn('Over 60 KB: use a smaller size or a tighter crop.');
console.log('Next: add it to `photos` in components/Photo.tsx and its source URL to assets/photos/CREDITS.md.');
