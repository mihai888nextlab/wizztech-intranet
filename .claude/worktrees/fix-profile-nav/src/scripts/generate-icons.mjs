/*
  Renders public/wizztech-logo.svg to the app icons and the favicon.

  The logo is a 24-polygon figure, so these are rasterised with ImageMagick
  rather than the hand-rolled PNG encoder this script used for the old single
  stroke "W" mark. Install it first (`dnf install ImageMagick`,
  `brew install imagemagick`); it is only needed to regenerate icons, never to
  build or run the app.

  The tiles are white rather than the brand blue: the owl's body is pale blue
  and its cap deep purple, and both lose separation on a saturated backdrop.

  Run:  node src/scripts/generate-icons.mjs
*/

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";

const SRC = "public/wizztech-logo.svg";
const OUT = "public/icons";
const TILE = "white";

if (!existsSync(SRC)) {
  console.error(`Missing ${SRC}.`);
  process.exit(1);
}

let magick;
for (const candidate of ["magick", "convert"]) {
  try {
    execFileSync(candidate, ["-version"], { stdio: "ignore" });
    magick = candidate;
    break;
  } catch {
    // Try the next name; ImageMagick 6 ships `convert`, 7 ships `magick`.
  }
}
if (!magick) {
  console.error("ImageMagick is not installed — see the note at the top of this file.");
  process.exit(1);
}

/**
 * One icon: the logo scaled to `glyphScale` of the canvas, centred on `tile`.
 * A null tile leaves the background transparent.
 */
function render(name, size, { tile = TILE, glyphScale = 0.72, radius = 0 } = {}) {
  const glyph = Math.round(size * glyphScale);
  const args = ["-background", "none", SRC, "-resize", `x${glyph}`];

  const composite = [
    "(", "-size", `${size}x${size}`, tile ? `xc:${tile}` : "xc:none", ")",
    "(", ...args, ")",
    "-gravity", "center", "-composite",
  ];

  // Rounded corners are punched out of the alpha channel, so the corners are
  // genuinely transparent rather than white.
  const rounded = radius
    ? [
        "(", "+clone", "-alpha", "extract", "-fill", "black", "-colorize", "100",
        "-fill", "white", "-draw",
        `roundrectangle 0,0 ${size - 1},${size - 1} ${radius},${radius}`,
        ")", "-alpha", "off", "-compose", "copyopacity", "-composite",
      ]
    : [];

  // Flat polygons need nothing like a full truecolour PNG; a 256-entry palette
  // is visually identical here and roughly a third of the bytes.
  execFileSync(magick, [
    ...composite,
    ...rounded,
    "-strip",
    "-colors", "256",
    `${OUT}/${name}`,
  ]);
  console.log(`  ${name.padEnd(22)} ${size}x${size}`);
}

mkdirSync(OUT, { recursive: true });

render("icon-192.png", 192, { radius: Math.round(192 * 0.22) });
render("icon-512.png", 512, { radius: Math.round(512 * 0.22) });
// Maskable: full bleed, glyph inside the middle 80% so an aggressive circular
// crop cannot clip it.
render("maskable-512.png", 512, { radius: 0, glyphScale: 0.56 });
// iOS rounds it itself and dislikes alpha, so keep it a full square.
render("apple-touch-icon.png", 180, { radius: 0 });
// Android tints the badge from alpha alone: silhouette only, no background.
render("badge-72.png", 72, { tile: null, glyphScale: 0.82 });

/*
  The favicon carries the three sizes browsers actually pick from. Larger frames
  are dead weight in a file requested on every page load — the whole .ico stays
  a few kilobytes this way, where adding 128 and 256 pushed it past 120 KB.

  It stays transparent rather than tiled: a white square is conspicuous against
  a dark tab strip, and the mark reads on either without one.
*/
execFileSync(magick, [
  "-background", "none", SRC, "-resize", "x64",
  "-gravity", "center", "-background", "none", "-extent", "64x64",
  "-define", "icon:auto-resize=16,32,48",
  "-strip",
  "public/favicon.ico",
]);
console.log("  favicon.ico            16,32,48");
