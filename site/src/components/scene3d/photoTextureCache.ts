/* ============================================================================
   photoTextureCache — a refcounted, LRU-evicting store for photo textures.

   The gallery hangs 20 canvases drawn from a 93-photo archive, and a photo at
   full /web/ resolution costs roughly 1400×930×4×1.33 ≈ 6.9 MB of VRAM once
   mipmapped. Loading all of them would be ~250 MB and would stall the walk.

   So: photos are requested at a tier chosen from how close and how visible each
   canvas currently is, tiers share one cache across the whole scene, and
   anything nothing is looking at gets disposed when the budget is exceeded.

   Deliberately imperative and synchronous to read. Callers poll `get()` from
   inside useFrame and assign `material.map` themselves, so a texture arriving
   never triggers a React render — the same reason the camera act passes scroll
   progress through a ref.
   ========================================================================== */

import * as THREE from "three";

export type Tier = "thumb" | "mid" | "web";

/** Ascending cost. `bestAtOrBelow` walks this backwards. */
export const TIERS: Tier[] = ["thumb", "mid", "web"];

/** Longest edge each tier is rendered at by tools/import_photos.py. */
const TIER_PX: Record<Tier, number> = { thumb: 480, mid: 960, web: 1400 };

const TIER_DIR: Record<Tier, string> = { thumb: "/thumbs/", mid: "/mid/", web: "/web/" };

/** `/web/ANK09879.jpg` → `/thumbs/ANK09879.jpg`. Every /web/ file is guaranteed
 *  a /mid/ and /thumbs/ sibling (see Photo.tsx's contract). */
export function tierUrl(src: string, tier: Tier): string {
  return src.replace("/web/", TIER_DIR[tier]);
}

interface Entry {
  texture: THREE.Texture | null;
  /** bytes once decoded, estimated from the tier and the photo's aspect */
  bytes: number;
  /** scope → refcount, so two scenes can share and neither frees the other's */
  refs: Map<string, number>;
  lastUsed: number;
  loading: boolean;
  failed: boolean;
}

const entries = new Map<string, Entry>();
const loader = new THREE.TextureLoader();
let clock = 0;
let budget = 96 * 1024 * 1024;
let anisotropy = 4;

const key = (src: string, tier: Tier) => `${tier}:${src}`;

/** RGBA8 plus a full mip chain (≈1.333×). */
function estimateBytes(tier: Tier, aspect: number) {
  const long = TIER_PX[tier];
  const w = aspect >= 1 ? long : Math.round(long * aspect);
  const h = aspect >= 1 ? Math.round(long / aspect) : long;
  return Math.round(w * h * 4 * 1.334);
}

export function setBudget(bytes: number) {
  budget = bytes;
}

/** Call once with renderer.capabilities.getMaxAnisotropy(). Canvases are viewed
 *  at a glancing angle as you walk past, which is exactly where anisotropic
 *  filtering earns its cost. */
export function setAnisotropy(max: number) {
  anisotropy = Math.min(4, Math.max(1, max));
}

/**
 * Register interest and begin loading if needed. Idempotent and cheap — safe to
 * call every few frames from useFrame.
 */
export function acquire(src: string, tier: Tier, scope: string, aspect = 1.5) {
  const k = key(src, tier);
  let e = entries.get(k);
  if (!e) {
    e = {
      texture: null,
      bytes: estimateBytes(tier, aspect),
      refs: new Map(),
      lastUsed: ++clock,
      loading: true,
      failed: false,
    };
    entries.set(k, e);
    loader.load(
      tierUrl(src, tier),
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.anisotropy = anisotropy;
        tex.needsUpdate = true;
        const live = entries.get(k);
        if (!live) {
          tex.dispose(); // released while in flight
          return;
        }
        live.texture = tex;
        live.loading = false;
        const img = tex.image as { width?: number; height?: number } | undefined;
        if (img?.width && img?.height) live.bytes = Math.round(img.width * img.height * 4 * 1.334);
        evict();
      },
      undefined,
      () => {
        const live = entries.get(k);
        if (live) {
          live.loading = false;
          live.failed = true;
        }
      }
    );
  }
  e.refs.set(scope, (e.refs.get(scope) ?? 0) + 1);
  e.lastUsed = ++clock;
  return e.texture;
}

export function release(src: string, tier: Tier, scope: string) {
  const e = entries.get(key(src, tier));
  if (!e) return;
  const n = (e.refs.get(scope) ?? 0) - 1;
  if (n > 0) e.refs.set(scope, n);
  else e.refs.delete(scope);
}

/** Drop every reference held by one scene. Call on unmount. */
export function releaseScope(scope: string) {
  for (const e of entries.values()) e.refs.delete(scope);
  evict(true);
}

/** Loaded texture for exactly this tier, or null. */
export function get(src: string, tier: Tier): THREE.Texture | null {
  const e = entries.get(key(src, tier));
  if (!e?.texture) return null;
  e.lastUsed = ++clock;
  return e.texture;
}

/**
 * Best already-loaded texture at or below `tier`, so a canvas shows a slightly
 * soft photo immediately rather than a blank frame while the sharp one loads.
 */
export function bestAtOrBelow(src: string, tier: Tier): { texture: THREE.Texture; tier: Tier } | null {
  const top = TIERS.indexOf(tier);
  for (let i = top; i >= 0; i--) {
    const t = TIERS[i];
    const tex = get(src, t);
    if (tex) return { texture: tex, tier: t };
  }
  // Nothing at or below — a higher tier may already be resident from elsewhere.
  for (let i = top + 1; i < TIERS.length; i++) {
    const tex = get(src, TIERS[i]);
    if (tex) return { texture: tex, tier: TIERS[i] };
  }
  return null;
}

/** Warm a texture without holding a reference (used for the opening shot). */
export function preload(src: string, tier: Tier, aspect = 1.5) {
  acquire(src, tier, "__preload", aspect);
  release(src, tier, "__preload");
}

/**
 * Dispose unreferenced textures, oldest first, until under budget.
 * `force` ignores the budget and drops everything unreferenced — used on
 * unmount so navigating away actually returns the memory.
 */
function evict(force = false) {
  let total = 0;
  for (const e of entries.values()) if (e.texture) total += e.bytes;
  if (!force && total <= budget) return;

  const droppable = [...entries.entries()]
    .filter(([, e]) => e.refs.size === 0 && e.texture)
    .sort((a, b) => a[1].lastUsed - b[1].lastUsed);

  for (const [k, e] of droppable) {
    if (!force && total <= budget) break;
    e.texture?.dispose();
    total -= e.bytes;
    entries.delete(k);
  }
}

export function stats() {
  let bytes = 0;
  let loaded = 0;
  let loading = 0;
  let referenced = 0;
  for (const e of entries.values()) {
    if (e.texture) {
      loaded++;
      bytes += e.bytes;
    }
    if (e.loading) loading++;
    if (e.refs.size) referenced++;
  }
  return { loaded, loading, referenced, bytes, budget };
}

/** Test/debug hook — drops everything, referenced or not. */
export function clearAll() {
  for (const e of entries.values()) e.texture?.dispose();
  entries.clear();
}
