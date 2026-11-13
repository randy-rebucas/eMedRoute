/**
 * Generates every icon, splash and store asset for eMedRoute from the MyClinicSoft mark
 * (heart + pulse, same geometry as components/BrandLogo.tsx). The rep app puts the mark on solid
 * brand navy so it is told apart from eMCR (teal) on the same phone.
 *
 *   node scripts/generate-brand.mjs
 *
 * Edit the SVG builders below and re-run; outputs are committed.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'assets');

// lib/theme.ts
const C = {
  accent: '#0EA5A4',
  primary: '#0A7F7E',
  primarySoft: '#E3F6F5',
  text: '#0B2136',
  textMuted: '#5B6B7A',
  navy: '#0B2136',
};

// 24-unit mark geometry, shared with BrandMark.
const HEART =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';
const PULSE = '3.5,11.5 8,11.5 9.5,8.5 11.5,15 13.5,7 15,11.5 20.5,11.5';
const HEART_CY = 12.175; // bbox vertical centre in mark units

const FONT = `'Segoe UI', 'Helvetica Neue', Arial, sans-serif`;

/** transform that centres the 24-unit mark at (cx, cy) with the given scale */
const place = (cx, cy, s) => `translate(${cx - 12 * s} ${cy - HEART_CY * s}) scale(${s})`;

const markGradient = (id) => `
  <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${C.accent}"/>
    <stop offset="1" stop-color="${C.primary}"/>
  </linearGradient>`;

/** White heart, teal pulse — sits on navy. */
const whiteMark = (cx, cy, s) => `
  <g transform="${place(cx, cy, s)}">
    <path d="${HEART}" fill="#FFFFFF"/>
    <polyline points="${PULSE}" fill="none" stroke="${C.primary}" stroke-width="1.6"
      stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;

/** Gradient heart, white pulse — the in-app BrandMark, for light surfaces. */
const colorMark = (cx, cy, s) => `
  <g transform="${place(cx, cy, s)}">
    <path d="${HEART}" fill="url(#mark)"/>
    <polyline points="${PULSE}" fill="none" stroke="#FFFFFF" stroke-width="1.5"
      stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;

/** Solid white heart with the pulse knocked out (monochrome / notification). */
const knockoutMark = (cx, cy, s) => `
  <mask id="ko" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
    <g transform="${place(cx, cy, s)}">
      <path d="${HEART}" fill="#FFFFFF"/>
      <polyline points="${PULSE}" fill="none" stroke="#000000" stroke-width="1.7"
        stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  </mask>
  <rect width="100%" height="100%" fill="#FFFFFF" mask="url(#ko)"/>`;

const svg = (w, h, body, defs = '') => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    ${markGradient('mark')}
    ${defs}
  </defs>
  ${body}
</svg>`;

// ---- Sources ---------------------------------------------------------------

/** iOS / store icon: full-bleed, opaque (iOS applies its own corner mask). */
const iconSvg = svg(1024, 1024, `
  <rect width="1024" height="1024" fill="${C.navy}"/>
  ${whiteMark(512, 520, 26)}`);

/** Android adaptive foreground: mark kept inside the 66dp safe circle (≈626px). */
const adaptiveFgSvg = svg(1024, 1024, whiteMark(512, 516, 23));
const adaptiveBgSvg = svg(1024, 1024, `<rect width="1024" height="1024" fill="${C.navy}"/>`);
const monochromeSvg = svg(1024, 1024, knockoutMark(512, 516, 23));

/** Splash image: the white mark; the navy background colour comes from app.json. */
const splashSvg = svg(1024, 1024, whiteMark(512, 512, 46));

/** Android status-bar notification icon: white on transparent, tinted by the OS. */
const notificationSvg = svg(96, 96, knockoutMark(48, 49, 3.4));

const wordmark = (x, y, size, { dark = true } = {}) => `
  <text x="${x}" y="${y}" font-family="${FONT}" font-weight="800" font-size="${size}"
    letter-spacing="${-size * 0.015}" fill="${dark ? C.text : '#FFFFFF'}">eMed<tspan fill="${dark ? C.primary : '#B9F2EF'}">Route</tspan></text>
  <text x="${x + size * 0.04}" y="${y + size * 0.5}" font-family="${FONT}" font-weight="700"
    font-size="${size * 0.3}" letter-spacing="${size * 0.03}" fill="${dark ? C.textMuted : '#D8F5F3'}">BY MYCLINICSOFT</text>`;

/** Horizontal lockup for docs, web, press. */
const logoSvg = (dark) => svg(1500, 360, `
  ${colorMark(180, 172, 11.5)}
  ${wordmark(345, 195, 130, { dark })}`);

/** Lockup on navy. */
const logoOnNavySvg = svg(1500, 360, `
  <rect width="1500" height="360" fill="${C.navy}"/>
  ${whiteMark(180, 172, 11.5)}
  ${wordmark(345, 195, 130, { dark: false })}`);

/** Google Play feature graphic, 1024×500. */
const featureSvg = svg(1024, 500, `
  <rect width="1024" height="500" fill="${C.navy}"/>
  <rect x="96" y="130" width="240" height="240" rx="56" fill="#FFFFFF"/>
  ${colorMark(216, 252, 8.6)}
  <text x="392" y="222" font-family="${FONT}" font-weight="800" font-size="84" letter-spacing="-1" fill="#FFFFFF">eMed<tspan fill="#B9F2EF">Route</tspan></text>
  <text x="396" y="272" font-family="${FONT}" font-weight="700" font-size="30" letter-spacing="3" fill="#D8F5F3">BY MYCLINICSOFT</text>
  <text x="396" y="340" font-family="${FONT}" font-weight="400" font-size="30" fill="#FFFFFF">Book clinic visits in their rep hours,</text>
  <text x="396" y="380" font-family="${FONT}" font-weight="400" font-size="30" fill="#FFFFFF">and carry your product sheets.</text>`);

// ---- Render ----------------------------------------------------------------

async function png(source, out, { size, opaque = false, trim = false } = {}) {
  const file = join(ASSETS, out);
  await mkdir(dirname(file), { recursive: true });
  let img = sharp(Buffer.from(source), { density: 72 });
  if (size) img = img.resize(size, size);
  if (trim) {
    // crop to content, then restore an even 40px margin
    img = sharp(await img.trim().toBuffer())
      .extend({ top: 40, bottom: 40, left: 40, right: 40, background: { r: 0, g: 0, b: 0, alpha: 0 } });
  }
  if (opaque) img = img.flatten({ background: C.navy }).removeAlpha();
  await img.png({ compressionLevel: 9 }).toFile(file);
  console.log('  ', out);
}

async function saveSvg(source, out) {
  const file = join(ASSETS, out);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, source);
  console.log('  ', out);
}

console.log('App assets');
await png(iconSvg, 'icon.png', { opaque: true });
await png(adaptiveFgSvg, 'android-icon-foreground.png');
await png(adaptiveBgSvg, 'android-icon-background.png', { opaque: true });
await png(monochromeSvg, 'android-icon-monochrome.png');
await png(splashSvg, 'splash-icon.png');
await png(notificationSvg, 'notification-icon.png');
await png(iconSvg, 'favicon.png', { size: 48, opaque: true });

console.log('Store assets');
await png(iconSvg, 'store/app-store-icon-1024.png', { opaque: true });
await png(iconSvg, 'store/play-store-icon-512.png', { size: 512, opaque: true });
await png(featureSvg, 'store/play-feature-graphic-1024x500.png', { opaque: true });

console.log('Brand kit');
await saveSvg(iconSvg, 'brand/rep-app-icon.svg');
await png(logoSvg(true), 'brand/rep-logo.png', { trim: true });
await png(logoSvg(false), 'brand/rep-logo-white.png', { trim: true });
await png(logoOnNavySvg, 'brand/rep-logo-on-navy.png', { opaque: true });
