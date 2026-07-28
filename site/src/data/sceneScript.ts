/* ============================================================================
   sceneScript — the scene-agnostic half of cameraScript.

   cameraScript grew all of this while there was only one 3D act on the site.
   There are now three (the home camera, the /work gallery, the /prints room),
   so the maths, the Shot/pose types and the camera-flight sampler live here and
   cameraScript re-exports them unchanged. Nothing about the home page's
   behaviour changes: samplePose(p) is still samplePoseIn(ANCHOR, SHOTS, p).

   The one addition is Shot.fov. A product shot of a camera body and a shot of a
   whole living room want different lenses; the home page's 13 shots simply omit
   it and keep the Canvas default.
   ========================================================================== */

export type Vec3 = [number, number, number];

/* ---------------------------------------------------------------- scalars -- */

export function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}
export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
export function smoothstep(a: number, b: number, x: number) {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
export function easeInOut(x: number) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

/** Frame-rate-independent exponential approach. `rate` is roughly "how many
 *  e-foldings per second"; higher converges faster. Use instead of a bare
 *  `lerp(cur, target, 0.1)` in useFrame, which silently changes speed with fps. */
export function damp(current: number, target: number, rate: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

/* --------------------------------------------------------------- vectors -- */

export function vlerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
export function norm(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
export function vadd(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
export function vsub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
export function vscale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}
export function vdot(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
export function vcross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/* ------------------------------------------------------------ wall mounts --
   Both new scenes hang flat things on walls, and both get their placements as
   a centre + a face normal (that is what the GLBs actually tell us). These two
   helpers turn that into something a mesh can use. */

/** Euler rotation that points a +Z-facing plane along `normal`.
 *  planeGeometry's front face is +Z, so this is all a wall-mounted quad needs. */
export function faceRotation(normal: Vec3): [number, number, number] {
  const n = norm(normal);
  // yaw about Y, then pitch about X — no roll, because a hung picture is level.
  const yaw = Math.atan2(n[0], n[2]);
  const pitch = -Math.asin(Math.max(-1, Math.min(1, n[1])));
  return [pitch, yaw, 0];
}

/**
 * Largest w×h of the given aspect ratio that fits inside an envelope.
 *
 * The gallery's 20 baked frames are all exactly 1.68 × 1.12 (3:2), but only 56
 * of the 93 photographs are 3:2 — 21 are 2:3 portrait and 5 are panoramas up to
 * 5.4:1. Rather than distort or crop them, each photo is matted inside the
 * frame's opening, which is how a real gallery hangs mixed formats.
 */
export function fitInside(aspect: number, envW: number, envH: number) {
  const w = Math.min(envW, envH * aspect);
  const h = w / aspect;
  return { w, h: Math.min(h, envH), scale: w / envW };
}

/* ------------------------------------------------------- camera flights --- */

export interface Shot {
  /** progress along the act, 0..1 */
  p: number;
  /** an anchor name in the scene's anchor map, or an explicit world point */
  focus: string | Vec3;
  /** direction from the focus point out toward the camera (normalised here) */
  dir: Vec3;
  /** how far back along dir */
  dist: number;
  /** optional vertical FOV in degrees; omit to hold the Canvas default */
  fov?: number;
}

export interface Pose {
  pos: Vec3;
  target: Vec3;
  fov?: number;
}

export type Anchors = Record<string, Vec3>;

export function resolveFocus(anchors: Anchors, focus: Shot["focus"]): Vec3 {
  if (Array.isArray(focus)) return focus;
  const a = anchors[focus];
  if (!a) throw new Error(`sceneScript: unknown anchor "${focus}"`);
  return a;
}

/** Resolve one shot to an absolute camera position + look-at target. */
export function shotToPoseIn(anchors: Anchors, s: Shot): Pose {
  const t = resolveFocus(anchors, s.focus);
  const d = norm(s.dir);
  return {
    pos: [t[0] + d[0] * s.dist, t[1] + d[1] * s.dist, t[2] + d[2] * s.dist],
    target: t,
    fov: s.fov,
  };
}

/** Sample a flight at progress p, smoothstep-interpolating between neighbours. */
export function samplePoseIn(anchors: Anchors, shots: Shot[], p: number): Pose {
  if (!shots.length) throw new Error("sceneScript: empty shot list");
  if (p <= shots[0].p) return shotToPoseIn(anchors, shots[0]);
  const last = shots[shots.length - 1];
  if (p >= last.p) return shotToPoseIn(anchors, last);

  for (let i = 0; i < shots.length - 1; i++) {
    const a = shots[i];
    const b = shots[i + 1];
    if (p >= a.p && p <= b.p) {
      const e = smoothstep(a.p, b.p, p);
      const pa = shotToPoseIn(anchors, a);
      const pb = shotToPoseIn(anchors, b);
      /* fov is optional per shot: carry the neighbour's value when only one
         side declares one, so a single wide shot does not snap the lens. */
      const fov =
        pa.fov !== undefined && pb.fov !== undefined
          ? lerp(pa.fov, pb.fov, e)
          : (pa.fov ?? pb.fov);
      return { pos: vlerp(pa.pos, pb.pos, e), target: vlerp(pa.target, pb.target, e), fov };
    }
  }
  return shotToPoseIn(anchors, last);
}

/** Index of the shot currently in play — handy for debug HUDs. */
export function shotIndexAt(shots: Shot[], p: number) {
  let i = 0;
  while (i < shots.length - 1 && p > shots[i + 1].p) i++;
  return i;
}
