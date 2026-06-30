import type { DepthHero } from "../data/photos";

/**
 * Base URL for full-resolution originals hosted off-repo (a CDN / object store)
 * instead of being committed to `public/` and shipped in the Vercel deploy.
 *
 * Set `VITE_MEDIA_BASE` in the Vercel project (and `.env.local` for dev) to the
 * public base of your bucket, WITHOUT a trailing slash, e.g.
 *   https://<ref>.supabase.co/storage/v1/object/public/photos
 *
 * The hero paths in `data/photos.ts` look like `/photos/ANK09879.jpg`, so the
 * resolved URL is `${MEDIA_BASE}/photos/ANK09879.jpg`. Upload originals under a
 * `photos/` prefix in the bucket (see `tools/upload-media.mjs`).
 *
 * Leave it unset and the app falls back to the bundled, optimized `/web/`
 * version — smaller, still fine for a WebGL plane, and guaranteed not to 404.
 */
export const MEDIA_BASE = (import.meta.env.VITE_MEDIA_BASE ?? "").replace(/\/+$/, "");

/**
 * Source for a hero's full-res depth-scene texture: the CDN original when
 * `VITE_MEDIA_BASE` is configured, otherwise the bundled `/web/` fallback.
 */
export function heroSource(hero: Pick<DepthHero, "photo" | "web">): string {
  return MEDIA_BASE ? MEDIA_BASE + hero.photo : hero.web;
}
