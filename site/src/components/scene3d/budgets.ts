/* ============================================================================
   budgets — the performance ceilings the 3D scenes are held to.

   Mirrors BUDGETS in tools/optimize_models.mjs, which exits non-zero when a
   model blows its byte/vertex ceiling. Kept here too so the ?debug HUD can show
   live numbers against the same targets rather than against a vibe.
   ========================================================================== */

export interface SceneBudget {
  /** GLB transfer size */
  bytes: number;
  verts: number;
  drawCalls: number;
  /** decoded photo-texture VRAM, desktop / mobile */
  photoVramDesktop: number;
  photoVramMobile: number;
  /** how many photo textures may be resident at once */
  residentPhotos: number;
}

const MB = 1024 * 1024;

export const BUDGETS: Record<"gallery" | "room", SceneBudget> = {
  /* 20 canvases visible a few at a time; the walk is continuous so this one
     runs an always-on frameloop and needs the most headroom. */
  gallery: {
    bytes: 2.5 * MB,
    verts: 60_000,
    drawCalls: 120,
    photoVramDesktop: 96 * MB,
    photoVramMobile: 24 * MB,
    residentPhotos: 24,
  },
  /* A configurator: one print, static camera, frameloop="demand". */
  room: {
    bytes: 8 * MB,
    verts: 200_000,
    drawCalls: 140,
    photoVramDesktop: 16 * MB,
    photoVramMobile: 8 * MB,
    residentPhotos: 3,
  },
};

/** Upper dpr bound. High-DPR phone GPUs rendering WebGL at native 3x is the
 *  single biggest mobile cost — the home page already caps this way. */
export function dprMax(): number {
  if (typeof window === "undefined") return 1.5;
  return Math.min(window.innerWidth, window.innerHeight) < 768 ? 1.5 : 2;
}

/** Photo-texture VRAM ceiling for this device. */
export function photoVramBudget(scene: "gallery" | "room"): number {
  const b = BUDGETS[scene];
  if (typeof window === "undefined") return b.photoVramMobile;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 820;
  return coarse && small ? b.photoVramMobile : b.photoVramDesktop;
}
