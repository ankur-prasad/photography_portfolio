#!/usr/bin/env node
// Upload full-resolution originals to a Supabase Storage bucket so they can be
// served from a CDN instead of bloating the Vercel deploy (Vercel's source
// limit is 100 MB on Hobby / 1 GB on Pro, and the originals are ~640 MB).
//
// Usage:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
//   node tools/upload-media.mjs [srcDir]
//
//   srcDir defaults to ./public/photos. The originals have been removed from
//   the repo to slim the deploy; restore them from git history first, e.g.
//     git checkout <commit-before-removal> -- site/public/photos
//   (or point srcDir at your own archive of the originals).
//
// Files are uploaded under a `photos/` prefix in the bucket so the public URL
// matches the `/photos/<name>` paths in src/data/photos.ts. After uploading,
// set in the Vercel project (Settings → Environment Variables) and redeploy:
//   VITE_MEDIA_BASE=https://<ref>.supabase.co/storage/v1/object/public/<bucket>
import { createClient } from "@supabase/supabase-js";
import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.MEDIA_BUCKET || "photos";
const SRC = process.argv[2] || "public/photos";

if (!URL || !KEY) {
  console.error("Missing env: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const CONTENT_TYPE = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const supa = createClient(URL, KEY, { auth: { persistSession: false } });

// Create the bucket (public) if it doesn't exist yet — ignore "already exists".
const { error: bucketErr } = await supa.storage.createBucket(BUCKET, { public: true });
if (bucketErr && !/exist/i.test(bucketErr.message)) {
  console.error(`Could not ensure bucket "${BUCKET}": ${bucketErr.message}`);
  process.exit(1);
}

let names;
try {
  names = (await readdir(SRC)).filter((f) => extname(f).toLowerCase() in CONTENT_TYPE);
} catch (e) {
  console.error(`Cannot read source dir "${SRC}": ${e.message}`);
  process.exit(1);
}

console.log(`Uploading ${names.length} files from ${SRC} → ${BUCKET}/photos/ …`);
let ok = 0;
const failed = [];
for (const name of names) {
  const body = await readFile(join(SRC, name));
  const { error } = await supa.storage.from(BUCKET).upload(`photos/${name}`, body, {
    contentType: CONTENT_TYPE[extname(name).toLowerCase()],
    upsert: true,
  });
  if (error) {
    failed.push(`${name}: ${error.message}`);
    continue;
  }
  ok++;
  process.stdout.write(`\r${ok}/${names.length}`);
}

console.log(`\nDone. ${ok}/${names.length} uploaded.`);
if (failed.length) {
  console.error(`Failed (${failed.length}):\n  ${failed.join("\n  ")}`);
}
console.log(`\nNow set in Vercel and redeploy:`);
console.log(`  VITE_MEDIA_BASE=${URL}/storage/v1/object/public/${BUCKET}`);
if (failed.length) process.exit(1);
