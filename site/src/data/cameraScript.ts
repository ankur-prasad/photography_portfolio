/* ============================================================================
   cameraScript — single source of truth for the camera-eye scroll experience.

   Both CameraModel (what is drawn) and CameraExperience (where the viewing
   camera flies + which copy shows) read from here so anchors never drift.

   Coordinate space = the NORMALISED model space after CameraModel centres the
   body at the origin and scales it (see BODY_FIT). In that space:
     +Z = front of the camera (lens points this way)
     -Z = back (rear screen / viewfinder eyepiece)
     +Y = up
     +X = grip side
   ========================================================================== */

export type Vec3 = [number, number, number];

/* body is scaled so its HEIGHT maps to this many world units (height is the
   one bbox dimension not inflated by the strap-lug scan artefacts). */
export const BODY_FIT = 1.5;

/* manual correction applied to the bbox-centred body — the raw scan isn't
   axis-aligned (strap-lug artefacts skew the bbox centre, and the scan
   itself sits a few degrees off true), so centring alone doesn't land it on
   the grid in AssetLab. ROTATION is applied first (about the bbox centre),
   then OFFSET nudges the result. Tune both by eye in AssetLab (/?lab →
   Body), then export and paste the result here. */
export const BODY_ROTATION: Vec3 = [0, 0.268, 0];
export const BODY_OFFSET: Vec3 = [0, 0, -0.403];

/* lens assembly (mounted on the body front). Tuned visually. */
export const LENS = {
  /* target outer diameter in world units (≈ the body mount diameter) */
  diameter: 0.84,
  /* depth nudge to seat the bayonet into the body mount ring (tuned) */
  seatZ: -0.62,
};

/* ---- final hand-placed transforms for the mounted/built parts, tuned by eye
   in the AssetLab sandbox (/?lab) against the normalised body and exported
   from there. These are absolute — they replace the ANCHOR-derived defaults
   those parts used before hand placement. Declared before ANCHOR so ANCHOR.evf
   (below) can read zoomTarget's position directly instead of duplicating it. ---- */
export const PLACEMENT: Record<string, { position: Vec3; rotation: Vec3; scale: Vec3 }> = {
  lens: { position: [0.209, -0.109, 0.469], rotation: [-0.012, 0.001, -0.007], scale: [1.264, 1.264, 1.264] },
  capCover: { position: [0.209, -0.109, -0.012], rotation: [-0.012, 0.001, -0.007], scale: [0.781, 0.781, 3.022] },
  sensor: { position: [0.209, -0.109, -0.009], rotation: [-0.012, 0.001, -0.007], scale: [0.97, 0.97, 0.97] },
  shutter: { position: [0.209, -0.109, 0.011], rotation: [-0.012, 0.001, -0.007], scale: [1.039, 1.069, 1.036] },
  iris: { position: [0.209, -0.109, 0.999], rotation: [-0.012, 0.001, -0.007], scale: [0.6, 0.6, 0.6] },
  /* flat rectangle marking where the real hero photo lives — a unit (1×1)
     plane, so scale.x/scale.y double as its width/height in world units.
     Tune it by hand in AssetLab (/?lab) against the real eyepiece, then
     export. The photo itself is rendered here directly (CameraModel's
     ViewfinderPhoto), not approximated by a separate DOM layer. */
  zoomTarget: { position: [0.211, 0.445, -0.926], rotation: [0, 0, 0], scale: [0.25, 0.181, 1.389] },
};

/* ---- anchors: the point each part lives at, in normalised model space ----
   measured against the body once normalised (mount centre ≈ +0.13, −0.03). */
/* these (everything but evf) are a computed best-effort: the old anchors,
   rigidly rotated/offset by BODY_ROTATION + BODY_OFFSET to follow the body's
   AssetLab correction. Unverified against the live render — check in
   ?debug and re-tune by eye if a label or shot lands off. */
export const ANCHOR: Record<string, Vec3> = {
  rear: [-0.312, 0.05, -1.541], // rear screen / eyepiece — the hero lives here
  evf: PLACEMENT.zoomTarget.position, // viewfinder hump — same point the photo actually lives at, so the "01 VIEWFINDER" label's leader-line points at it, not a separate guess
  lensMid: [0.417, -0.03, 0.623], // middle of the lens barrel (seated centre ≈ 1.08)
  lensFront: [0.523, -0.03, 1.009], // front element / iris (front glass ≈ 1.61)
  mount: [0.438, -0.03, 0.7], // open lens-mount plane — shutter + sensor live here
  sensor: [0.438, -0.03, 0.7], // built sensor, seated in the open mount
  body: [0.139, 0.04, -0.389], // body core — processor
};

/* world-Z of the built sensor / cap-cover plate, seated clearly in front of the
   body cap (cap front ≈ 1.175) so it fully occludes it without z-fighting */
export const SENSOR_Z = 1.3;

/* ---- narration: ordered parts (viewfinder first, per the brief) ---- */
export interface Part {
  no: string;
  name: string;
  eye: string;
  side: "left" | "right";
  body: string;
  anchor: keyof typeof ANCHOR;
  beat: number; // which beat index this copy belongs to
}
export const PARTS: Part[] = [
  {
    no: "01", name: "Viewfinder", eye: "Fovea", side: "right", anchor: "evf", beat: 1,
    body: "A small, bright window of total clarity — the frame you just left was sitting inside it. The fovea at the centre of your gaze.",
  },
  {
    no: "02", name: "Lens", eye: "Cornea + lens", side: "right", anchor: "lensMid", beat: 2,
    body: "Light enters through curved glass and is bent toward a single point — the same first move your cornea and lens make to focus the world.",
  },
  {
    no: "03", name: "Aperture", eye: "Iris & pupil", side: "left", anchor: "lensFront", beat: 3,
    body: "A ring of blades opens and closes to meter the light. It is the iris — widening in the dark, narrowing in the sun.",
  },
  {
    no: "04", name: "Shutter", eye: "Eyelid", side: "right", anchor: "mount", beat: 4,
    body: "It opens for a measured instant, then shuts. A blink — timed, here, to a thousandth of a second.",
  },
  {
    no: "05", name: "Sensor", eye: "Retina", side: "left", anchor: "sensor", beat: 5,
    body: "Where light stops being light and becomes signal. Millions of sites read the image, the way rods and cones line your retina.",
  },
  {
    no: "06", name: "Processor", eye: "Visual cortex", side: "left", anchor: "body", beat: 6,
    body: "Raw signal is not yet a picture. The processor assembles it — the quiet work your visual cortex does to turn seeing into sight.",
  },
];

/* ---- beat boundaries (scroll progress → current beat) ----
   0 hero · 1 viewfinder · 2 lens · 3 aperture · 4 shutter · 5 sensor ·
   6 processor · 7 thesis/handoff */
export function beatFor(p: number): number {
  if (p < 0.10909) return 0;
  if (p < 0.2) return 1;
  if (p < 0.36) return 2;
  if (p < 0.52) return 3;
  if (p < 0.66) return 4;
  if (p < 0.8) return 5;
  if (p < 0.93) return 6;
  return 7;
}

/* ---- viewfinder flipbook (the photo cycling as the act opens) ----
   As the camera holds tight on the viewfinder, the photo riffles through a
   handful of frames (a film/burst advancing), then LANDS on the eye close-up
   and holds — handing straight off to the "A camera mimics the eye" caption.

   Timing is keyed to the HUD frame counter (bottom-right): HUD frame ≈ local
   act progress * 1833.3 (see CameraExperience). That caption fades in with the
   "reveal" phase at frame ~86 (p 0.04692). We land the eye ~5 frames earlier,
   at frame 81, so it's already settled and still when the words arrive. Tune
   EYE_LAND_P if the section height (and thus the local→frame ratio) changes. */
export const EYE_LAND_P = 0.0442; // ≈ HUD frame 81 — eye lands here, then holds
export function viewfinderIndexFor(p: number, count: number): number {
  if (count <= 1) return 0;
  // floor-buckets across [0, EYE_LAND_P]; the last index (the eye) is reached
  // exactly at EYE_LAND_P and then clamped/held for the rest of the act.
  return Math.min(count - 1, Math.max(0, Math.floor((p / EYE_LAND_P) * (count - 1))));
}

/* ---- which optics are present, by scroll progress ----
   The lens is mounted for the reveal / lens / aperture beats, then "comes
   off" so the open mount + sensor read (shutter, sensor, processor beats),
   and re-mounts for the closing settle. */
export function lensVisFor(p: number): number {
  const off = smoothstep(0.5, 0.57, p); // detaches after the aperture beat
  const on = smoothstep(0.8, 0.87, p); // re-mounts right after the sensor beat
  return 1 - off + on;
}

/* the built mount interior (cap-cover + sensor well) is shown while the lens
   is off */
export function mountOpenFor(p: number): number {
  return smoothstep(0.5, 0.57, p) * (1 - smoothstep(0.8, 0.86, p));
}

/* the purple sensor fades in for its own beat */
export function sensorVisFor(p: number): number {
  return smoothstep(0.64, 0.7, p) * (1 - smoothstep(0.84, 0.89, p));
}

/* shutter curtain: present for the shutter beat, and stays parked (open, at
   the frame edges) through the sensor beat — the open curtain blades are
   exactly what mask the body's mount-rim geometry poking through at the
   top/bottom of the sensor cutout. Clears right after the sensor beat, when
   the lens re-mounts and hides the mount opening anyway. */
export function shutterVisFor(p: number): number {
  return smoothstep(0.52, 0.57, p) * (1 - smoothstep(0.8, 0.86, p));
}

/* shutter open amount: closed at the start of the shutter beat, opens and
   stays open to reveal the sensor */
export function shutterOpenFor(p: number): number {
  return smoothstep(0.58, 0.65, p);
}

/* iris (inside the lens) reacts like a pupil across the aperture beat */
export function irisOpenFor(p: number): number {
  const narrow = smoothstep(0.38, 0.45, p) * (1 - smoothstep(0.48, 0.54, p));
  return 0.72 - narrow * 0.42;
}

/* dip the BARREL/GLASS (the real scanned lens.mats — i.e. the tube walls,
   not just the front cap) so the opaque front element doesn't hide the iris
   while it narrows. Kept narrow/windowed on purpose: the barrel is one
   continuous tube wall, so dipping it for longer than this brief dead-on
   moment would make the SIDES of the tube translucent too, exposing the
   iris/mount hardware through the barrel from any side/¾ viewing angle —
   not just the front opening. Unchanged from the original aperture-beat
   reveal (Ankur: keep this behaviour as-is, aperture through sensor). */
export function lensGlassDipFor(p: number): number {
  return smoothstep(0.38, 0.45, p) * (1 - smoothstep(0.48, 0.54, p));
}

/* the front cap disc (CameraModel's M.frontGlass) is a thin, dedicated disc
   in front of the barrel's own (opaque) front face — not a tube wall, so
   keeping IT translucent from any angle is safe: viewed off-axis it's
   nearly edge-on and reads as a glassy glint, never exposes interior guts.
   Always at least this dipped so the front of the lens never reads as flat
   opaque black — lensGlassDipFor's brief aperture-beat spike pushes it
   fully transparent on top of this baseline so the iris reads clearly
   dead-on. Tune the 0.7 baseline by eye. */
export function frontGlassDipFor(p: number): number {
  return Math.max(0.7, lensGlassDipFor(p));
}

/* ---- viewing-camera flight: one shot per story point ----
   dir = direction from the focus point out to the camera (will be normalised)
   dist = how far back along dir
   up   = optional camera up tweak (default +Y) */
export interface Shot {
  p: number;
  focus: keyof typeof ANCHOR | Vec3;
  dir: Vec3;
  dist: number;
}
export const SHOTS: Shot[] = [
  /* on the viewfinder photo itself — true zoom-out starts here, not on a
     different anchor the camera "happens to be near". dir is close to the
     plane's actual front-face normal (verified numerically: [0.264, 0, -0.965]
     after CameraModel's ViewfinderPhoto 180° flip) so the photo reads
     straight-on rather than skewed. dist=0.15 (~104–123% overscan) opens
     FULL-BLEED/zoomed — Ankur wants the hero photo filling the frame at the
     open (reverted from the fit-to-frame dist=0.24 experiment), then the
     zoom-out reveals it was a tiny viewfinder the whole time. Verified against
     a 3:2 hero (water ANK00641 is 3936×2624). Tune by eye against the window. */
  { p: 0.0, focus: PLACEMENT.zoomTarget.position, dir: [0.004, 0.05, -0.965], dist: 0.15 },
  { p: 0.12, focus: "body", dir: [0.384, 0.311, -0.869], dist: 4.235 }, // pull way back — whole camera, viewfinder revealed
  { p: 0.27, focus: "lensMid", dir: [0.92, 0.32, 0.55], dist: 3.7 }, // side-3/4 so the barrel + markings read
  { p: 0.42, focus: [0.202, -0.127, 0.5], dir: [0.016, 0.048, 0.993], dist: 3.858 }, // dead-on into the front element (iris)
  { p: 0.58, focus: [0.207, -0.118, 0.58], dir: [0.018, 0.046, 0.998], dist: 2.568 }, // lens off — dead-on into the open mount (shutter)
  { p: 0.72, focus: [0.21, -0.114, 0.705], dir: [0.016, 0.037, 0.99], dist: 1.172 }, // dead-on into the mount — the sensor
  { p: 0.87, focus: "body", dir: [-0.77, 0.267, 0.58], dist: 4.866 }, // processor — whole body, 3/4
  { p: 1.0, focus: "body", dir: [-0.003, 0.258, -0.966], dist: 3.398 }, // settle on a clean 3/4 (lens back on)
];

/* ---- math helpers (shared) ---- */
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

function vlerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
function norm(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/* resolve a shot to an absolute camera position + look-at target */
export function shotToPose(s: Shot): { pos: Vec3; target: Vec3 } {
  const t = Array.isArray(s.focus) ? s.focus : ANCHOR[s.focus];
  const d = norm(s.dir);
  return { pos: [t[0] + d[0] * s.dist, t[1] + d[1] * s.dist, t[2] + d[2] * s.dist], target: t };
}

/* sample the flight at progress p — interpolates pose between adjacent shots */
export function samplePose(p: number): { pos: Vec3; target: Vec3 } {
  if (p <= SHOTS[0].p) return shotToPose(SHOTS[0]);
  if (p >= SHOTS[SHOTS.length - 1].p) return shotToPose(SHOTS[SHOTS.length - 1]);
  for (let i = 0; i < SHOTS.length - 1; i++) {
    const a = SHOTS[i], b = SHOTS[i + 1];
    if (p >= a.p && p <= b.p) {
      const e = smoothstep(a.p, b.p, p);
      const pa = shotToPose(a), pb = shotToPose(b);
      return { pos: vlerp(pa.pos, pb.pos, e), target: vlerp(pa.target, pb.target, e) };
    }
  }
  return shotToPose(SHOTS[SHOTS.length - 1]);
}
