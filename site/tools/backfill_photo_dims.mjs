#!/usr/bin/env node
/* ============================================================================
   backfill_photo_dims — add w/h to every meta entry in public/data/photos.json.

   tools/import_photos.py now emits these, but regenerating photos.json needs
   the full source photo library on disk. This reads the dimensions straight out
   of the already-rendered public/web/*.jpg headers instead, so the manifest can
   be brought up to date without it. Idempotent — safe to re-run.

   Why the site needs it: a 3D quad must be sized before the first frame is
   drawn, and printConfig's bestSizes() picks a different SKU list per aspect
   ratio. Without stored dimensions both fall back to assuming 3:2, which is
   wrong for 37 of the 93 photos.

     node tools/backfill_photo_dims.mjs
   ========================================================================== */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = join(SITE, "public", "data", "photos.json");

/** Width/height from a JPEG's first SOFn marker. */
function jpegSize(buf) {
  if (buf.readUInt16BE(0) !== 0xffd8) return null;
  let p = 2;
  while (p < buf.length - 9) {
    if (buf[p] !== 0xff) {
      p++;
      continue;
    }
    const marker = buf[p + 1];
    // SOF0..SOF15 carry the frame dimensions; C4/C8/CC are not SOF markers.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(p + 5), w: buf.readUInt16BE(p + 7) };
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      p += 2;
      continue;
    }
    p += 2 + buf.readUInt16BE(p + 2);
  }
  return null;
}

const data = JSON.parse(readFileSync(MANIFEST, "utf8"));
let added = 0;
let already = 0;
const missing = [];
const aspects = new Map();

for (const [webPath, meta] of Object.entries(data.meta)) {
  const file = join(SITE, "public", webPath.replace(/^\//, ""));
  if (!existsSync(file)) {
    missing.push(webPath);
    continue;
  }
  const size = jpegSize(readFileSync(file));
  if (!size) {
    missing.push(webPath);
    continue;
  }
  if (meta.w === size.w && meta.h === size.h) already++;
  else added++;
  meta.w = size.w;
  meta.h = size.h;
  const a = (size.w / size.h).toFixed(3);
  aspects.set(a, (aspects.get(a) ?? 0) + 1);
}

writeFileSync(MANIFEST, JSON.stringify(data, null, 0));

console.log(`photos.json: ${added} updated, ${already} already current`);
if (missing.length) console.warn(`  ⚠ no /web/ file for: ${missing.join(", ")}`);
console.log(
  `  aspect spread: ` +
    [...aspects.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([a, n]) => `${a}×${n}`)
      .join("  ")
);
