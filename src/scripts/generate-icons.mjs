/*
  Renders the WizzTech mark to PNG app icons.

  Written by hand rather than pulling in an image library or screenshotting a
  browser: headless screenshots composite onto an opaque white backdrop, which
  puts white corners on rounded icons and makes the notification badge — which
  Android tints from its alpha channel — come out as a solid white square.

  Run:  node src/scripts/generate-icons.mjs
*/

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "public/icons";
const BRAND = [22, 93, 252]; // --primary in light mode, #165dfc
const WHITE = [255, 255, 255];

/** The mark: a stroked "W" on a 24x24 grid, matching src/components/brand.tsx. */
const GLYPH = [
  [3, 6],
  [6.5, 18],
  [12, 8],
  [17.5, 18],
  [21, 6],
];
const GLYPH_STROKE = 2.5;

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // Filter byte 0 on every scanline; deflate does the compressing.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Distance from a point to a line segment — gives round caps and joins free. */
function distToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Signed distance to a rounded rectangle; negative inside. */
function roundedRectDist(px, py, w, h, r) {
  const qx = Math.abs(px - w / 2) - (w / 2 - r);
  const qy = Math.abs(py - h / 2) - (h / 2 - r);
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
  );
}

const SAMPLES = 4; // 4x4 supersampling, enough to hide the stair-stepping

function render(size, { radius = 0, background = null, glyphScale = 0.58 }) {
  const rgba = Buffer.alloc(size * size * 4);
  // Fit the 24-unit glyph box into the requested fraction of the icon.
  const scale = (size * glyphScale) / 24;
  const offset = (size - 24 * scale) / 2;
  const points = GLYPH.map(([x, y]) => [offset + x * scale, offset + y * scale]);
  const half = (GLYPH_STROKE * scale) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgHits = 0;
      let glyphHits = 0;

      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const px = x + (sx + 0.5) / SAMPLES;
          const py = y + (sy + 0.5) / SAMPLES;

          if (background && roundedRectDist(px, py, size, size, radius) <= 0) bgHits++;

          let inGlyph = false;
          for (let i = 0; i < points.length - 1 && !inGlyph; i++) {
            if (distToSegment(px, py, points[i], points[i + 1]) <= half) inGlyph = true;
          }
          if (inGlyph) glyphHits++;
        }
      }

      const total = SAMPLES * SAMPLES;
      const bgA = background ? bgHits / total : 0;
      const glyphA = glyphHits / total;
      // Glyph over background, both premultiplied by coverage.
      const alpha = Math.min(1, bgA + glyphA);
      const out = [0, 0, 0];
      for (let c = 0; c < 3; c++) {
        const base = background ? background[c] * bgA : 0;
        out[c] = alpha === 0 ? 0 : Math.round((base * (1 - glyphA) + WHITE[c] * glyphA) / alpha);
      }

      const o = (y * size + x) * 4;
      rgba[o] = out[0];
      rgba[o + 1] = out[1];
      rgba[o + 2] = out[2];
      rgba[o + 3] = Math.round(alpha * 255);
    }
  }
  return encodePng(size, size, rgba);
}

mkdirSync(OUT, { recursive: true });

const icons = [
  // Rounded tile with genuinely transparent corners.
  ["icon-192.png", 192, { radius: 192 * 0.22, background: BRAND }],
  ["icon-512.png", 512, { radius: 512 * 0.22, background: BRAND }],
  // Maskable: full bleed, glyph inside the middle 80% safe zone so an
  // aggressive circular crop cannot clip it.
  ["maskable-512.png", 512, { radius: 0, background: BRAND, glyphScale: 0.42 }],
  // iOS rounds it itself and dislikes alpha, so keep it a full square.
  ["apple-touch-icon.png", 180, { radius: 0, background: BRAND }],
  // Android tints the badge from alpha alone: glyph only, no background.
  ["badge-72.png", 72, { background: null, glyphScale: 0.78 }],
];

for (const [name, size, options] of icons) {
  const png = render(size, options);
  writeFileSync(`${OUT}/${name}`, png);
  console.log(`  ${name.padEnd(22)} ${size}x${size}  ${png.length} bytes`);
}
