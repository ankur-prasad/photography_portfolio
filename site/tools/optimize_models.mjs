#!/usr/bin/env node
/* ============================================================================
   optimize_models — turn the two raw Sketchfab scene GLBs into shippable
   .min.glb files, and emit the placement data the runtime needs.

   WHY THIS EXISTS
   The raw sources are 133 MB (modern_living_room) and 44.6 MB (art_gallery).
   The largest model the site currently ships is 2.7 MB. They also cannot live
   under site/public/ at all — Vite copies public/ verbatim into dist/, so a
   source GLB parked there ships to production. Sources live in
   assets/models-src/ (gitignored); this script writes the committed outputs.

   The .min.glb files for the camera were made externally with no committed
   script, so nobody could reproduce or re-tune them. This closes that gap.

   ORDER MATTERS: stage 0 MEASURES and writes src/data/*Placements.ts BEFORE
   any mutation, because the geometry we measure is the geometry we then
   delete. The living-room painting and the gallery's 20 blank canvases are
   removed here; the runtime redraws them as its own quads at the measured
   placements (see the header of each generated file for why).

   Usage:
     npm run models:optimize                 # both scenes
     node tools/optimize_models.mjs --only=gallery
     node tools/optimize_models.mjs --skip-textures    # fast geometry iteration
   ========================================================================== */

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  prune,
  weld,
  join,
  simplify,
  instance,
  resample,
  textureCompress,
  meshopt,
} from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { writeFileSync, mkdirSync, statSync, existsSync } from "node:fs";
import { resolve, dirname, join as pathJoin } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(HERE, "..");
const REPO = resolve(SITE, "..");
const SRC_DIR = process.env.MODELS_SRC || pathJoin(REPO, "assets", "models-src");
const OUT_DIR = pathJoin(SITE, "public", "models");
const DATA_DIR = pathJoin(SITE, "src", "data");

const argv = process.argv.slice(2);
const ONLY = (argv.find((a) => a.startsWith("--only=")) || "").split("=")[1] || null;
const SKIP_TEXTURES = argv.includes("--skip-textures");

/* ---------------------------------------------------------------- budgets --
   Enforced: the script exits non-zero if an output blows its ceiling, so the
   pipeline cannot silently regress. Mirrored in src/components/scene3d/budgets.ts. */
const BUDGETS = {
  art_gallery: { bytes: 2.5 * 1024 * 1024, verts: 60_000 },
  modern_living_room: { bytes: 8 * 1024 * 1024, verts: 200_000 },
};

/* ------------------------------------------------------------ prune lists --
   Node names to delete outright, deepest-first. Measured vertex shares are in
   the comments — these five patterns are ~75% of the living room and ~92% of
   the gallery. */

const ROOM_PRUNE = [
  /* The painting. Removed so the runtime can hang its own to-scale print here.
     Deleting offline (rather than visible=false at runtime) avoids z-fighting
     with the coincident glass quad and avoids the material-sharing hazard:
     `Black` and `GlassD1` are ALSO used by Plane_Black_0, D2_Black_0,
     D2.005_Black_0, D1.008_GlassD1_0, D1.011_GlassD1_0 and D3_GlassD1_0, so
     hiding by material would black out six unrelated objects. */
  /^Painting$/,
  /^Painting_(Black|Painting|GlassD1)_0$/,

  /* Decorative clutter on the shelf wall at z ≈ -0.7, behind the stairs and
     out of every print shot. 48 + 26 nodes, many 65k verts each. */
  /^D1[._]/, // 775,669 verts — 58.1%
  /^D2[._]/, // 159,213 verts — 11.9%
  /^AloeVera/, //  58,115 verts — same wall
  /^POTHOS/, //   7,462 verts — same wall
  /^POT_WOOD_LEGS/, //   2,548 verts — same wall
];
/* NOT pruned, deliberately: D3* (78k verts) reads as far-wall clutter by name
   but its world AABB is [-0.69..0.09, 0.48..1.03, 3.75..4.38] — it is the
   coffee-table decor, dead centre of the print shot. Ficus Elastica (51k) sits
   at x -3.15..-1.40 beside the print wall. Both stay and get simplified. */

const GALLERY_PRUNE = [
  /* 443,651 verts (88.4%) of purely decorative ceiling wire above the
     sightline, plus 20,153 more on the lamp base. Targeted by exact node name
     so LampBase_Emissive_0 survives and the ceiling still reads as lit. */
  /^CeillingWire/,
  /^LampBase_CeillingWire_0$/,

  /* The 20 blank grey canvases. The runtime draws its own quads at the
     measured placements instead of texturing these, for two reasons:
       1. The baked UVs are inconsistently handed — mesh 12's front faces map u
          left→right as the viewer sees them, mesh 11/13's map it right→left,
          so 8 of 20 slots would show MIRRORED photographs.
       2. Every slot is exactly 1.68 × 1.12 (3:2), but only 56 of the 93 photos
          are 3:2. 21 are 2:3 portrait and 5 are panoramas up to 5.4:1, so each
          photo has to be matted inside the frame envelope. */
  /^Paitings(Inside|Outside)/, // sic — the source model misspells "Paintings"

  /* 24 empty spotlight placeholder transforms (72 nodes with their children).
     Their ring geometry is extracted to SPOT_RING first; the runtime pools 4
     real lights and slides them along the ring. */
  /^LightParent/,
];

/* Textures whose material is a surface you stand right next to keep 1024;
   everything else drops to 512. Matched against the texture names this script
   assigns in stage 1 (the sources ship 114 + 21 unnamed textures). */
const ROOM_SHARP = /^(Wall2|Walls|Floor|Couch|Rug|Window|SyntticWood)_/;
const GALLERY_SHARP = /^(Walls|Floor|Ceilling)_/;

/* ============================================================ matrix maths ==
   glTF matrices are column-major 16-arrays. Kept local rather than pulling in
   gl-matrix: it is 40 lines and the script must run with no runtime deps
   beyond gltf-transform itself. */

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function matMul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  }
  return o;
}

function xformPoint(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function normalize(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
const r4 = (n) => Math.round(n * 1e4) / 1e4;
const v4 = (v) => `[${v.map(r4).join(", ")}]`;

/** Walk the scene graph, calling visit(node, worldMatrix, depth). */
function walkScene(scene, visit) {
  const rec = (node, parentMatrix, depth) => {
    const world = matMul(parentMatrix, node.getMatrix());
    visit(node, world, depth);
    for (const child of node.listChildren()) rec(child, world, depth + 1);
  };
  for (const root of scene.listChildren()) rec(root, IDENTITY, 0);
}

/** Every drawable primitive with its world matrix, plus a name→node index. */
function collectScene(doc) {
  const scene = doc.getRoot().listScenes()[0];
  const prims = [];
  const byName = new Map();
  walkScene(scene, (node, world) => {
    const name = node.getName();
    if (name && !byName.has(name)) byName.set(name, { node, world });
    const mesh = node.getMesh();
    if (!mesh) return;
    for (const prim of mesh.listPrimitives()) {
      prims.push({ node, name, world, mesh, prim });
    }
  });
  return { scene, prims, byName };
}

/** World-space POSITION list for one primitive. */
function worldPositions(prim, world) {
  const pos = prim.getAttribute("POSITION");
  if (!pos) return [];
  const out = [];
  const tmp = [0, 0, 0];
  for (let i = 0; i < pos.getCount(); i++) {
    pos.getElement(i, tmp);
    out.push(xformPoint(world, tmp));
  }
  return out;
}

function aabbOf(points) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of points) {
    for (let k = 0; k < 3; k++) {
      if (p[k] < min[k]) min[k] = p[k];
      if (p[k] > max[k]) max[k] = p[k];
    }
  }
  return { min, max, size: sub(max, min), centre: scale(add(min, max), 0.5) };
}

function vertCount(doc) {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) n += prim.getAttribute("POSITION")?.getCount() ?? 0;
  return n;
}

function primCount(doc) {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) n += mesh.listPrimitives().length;
  return n;
}

const mb = (b) => `${(b / 1048576).toFixed(2)} MB`;

/* ====================================================== stage 0: measure ====
   Runs on the untouched document. Everything below writes TypeScript into
   src/data/, which the runtime imports. */

const GEN_HEADER = (script, source) =>
  `/* GENERATED by site/tools/${script} — DO NOT EDIT BY HAND.
   Regenerate with \`npm run models:optimize\`.

   Measured from ${source} BEFORE the geometry was pruned, in world space with
   the scene's root matrix already applied (both sources are Z-up FBX exports
   whose root node carries a Z-up→Y-up rotation, so these are the Y-up numbers
   the runtime actually needs). Units are metres.
*/\n\n`;

/**
 * The living-room painting: three sibling mesh nodes under a group node whose
 * local matrix has wildly non-uniform scale (row magnitudes ≈ 371 / 10.4 /
 * 584.5). We therefore resolve everything to WORLD space here and the runtime
 * mounts its print as a scene-root sibling with a clean transform — never as a
 * child of that group.
 */
function measureRoom(doc) {
  const { prims, byName } = collectScene(doc);
  const find = (name) => prims.filter((p) => p.name === name);

  const canvas = find("Painting_Painting_0")[0];
  if (!canvas) throw new Error("Painting_Painting_0 not found — model changed?");

  const quad = worldPositions(canvas.prim, canvas.world);
  if (quad.length !== 4) throw new Error(`expected a 4-vert canvas quad, got ${quad.length}`);

  // Normal straight from the world-space triangle: exact regardless of the
  // parent's non-uniform scale (an inverse-transpose would be needed if we
  // transformed the baked NORMAL attribute instead).
  let normal = normalize(cross(sub(quad[1], quad[0]), sub(quad[2], quad[0])));
  // Face into the room: the room interior is at +X of this wall.
  if (normal[0] < 0) normal = scale(normal, -1);

  const up = [0, 1, 0];
  const right = normalize(cross(up, normal));
  const box = aabbOf(quad);
  const extentAlong = (axis) => {
    const ds = quad.map((p) => dot(p, axis));
    return Math.max(...ds) - Math.min(...ds);
  };

  const frame = find("Painting_Black_0")[0];
  const frameBox = frame ? aabbOf(worldPositions(frame.prim, frame.world)) : null;

  const named = (name) => {
    const hits = find(name);
    if (!hits.length) return null;
    return aabbOf(hits.flatMap((h) => worldPositions(h.prim, h.world)));
  };
  const wall = named("Plane_Wall2_0");
  const floor = named("Plane_Floor_0");
  const couch = named("Couch_Couch_0");
  const rug = named("Rug_Rug_0");
  const window = named("Window_Window_0");
  const lamps = named("ModernLamps_ModernLamps_0");

  const all = aabbOf(prims.flatMap((p) => worldPositions(p.prim, p.world)));

  const ts =
    GEN_HEADER("optimize_models.mjs", "assets/models-src/modern_living_room.glb") +
    `import type { Vec3 } from "./sceneScript";

/** Where the original painting hung. The print wall's outward normal is +X, so
 *  a viewer facing it has their right hand toward ${v4(right)}. */
export const PAINTING = {
  /** centre of the removed canvas quad */
  centre: ${v4(box.centre)} as Vec3,
  normal: ${v4(normal)} as Vec3,
  up: ${v4(up)} as Vec3,
  right: ${v4(right)} as Vec3,
  /** the removed canvas was this big — 2.85 m tall, far larger than any print */
  width: ${r4(extentAlong(right))},
  height: ${r4(extentAlong(up))},
  /** plane offset along the normal (the wall face the print beds against) */
  planeX: ${r4(box.centre[0])},
${
  frameBox
    ? `  /** the removed frame box, for reference */
  frame: { min: ${v4(frameBox.min)} as Vec3, max: ${v4(frameBox.max)} as Vec3 },`
    : ""
}
} as const;

/** Measured context, so hang height and camera shots can be reasoned about in
 *  real numbers instead of guessed. */
export const ROOM = {
  bounds: { min: ${v4(all.min)} as Vec3, max: ${v4(all.max)} as Vec3 },
${wall ? `  wall:   { min: ${v4(wall.min)} as Vec3, max: ${v4(wall.max)} as Vec3 },\n` : ""}${
      floor ? `  floorY: ${r4(floor.max[1])},\n` : ""
    }${
      couch
        ? `  /** sofa back top — the print must clearly clear this */
  couch:  { min: ${v4(couch.min)} as Vec3, max: ${v4(couch.max)} as Vec3 },\n`
        : ""
    }${rug ? `  rug:    { min: ${v4(rug.min)} as Vec3, max: ${v4(rug.max)} as Vec3 },\n` : ""}${
      window ? `  window: { min: ${v4(window.min)} as Vec3, max: ${v4(window.max)} as Vec3 },\n` : ""
    }${lamps ? `  lamps:  { min: ${v4(lamps.min)} as Vec3, max: ${v4(lamps.max)} as Vec3 },\n` : ""}} as const;
`;

  writeFileSync(pathJoin(DATA_DIR, "roomPlacements.ts"), ts);
  console.log(`  → src/data/roomPlacements.ts`);
  console.log(
    `    painting centre ${v4(box.centre)} normal ${v4(normal)} ` +
      `${r4(extentAlong(right))} × ${r4(extentAlong(up))} m`
  );
  if (couch) console.log(`    couch top y=${r4(couch.max[1])}  floor y=${floor ? r4(floor.max[1]) : "?"}`);
  return { byName };
}

/**
 * The gallery's 20 canvases live in three merged meshes. Each canvas is a thin
 * box: 6 quads for the free-standing inner/mid panels, 5 for the outer ones
 * that back onto the wall. Vertices come in runs of 4 per quad.
 */
function measureGallery(doc) {
  const { prims } = collectScene(doc);

  /* Three merged meshes. `ring` is only a naming/grouping label — which way
     each canvas FACES is derived from the architecture below, not assumed.

     Verified layout (world space, painting height band y 1.0–2.6):
       - the outer dodecagon wall sits at r ≈ 8.19
       - the inner core is a HOLLOW square column whose wall spans
         r ≈ 4.68 (interior surface) → 5.12 (exterior surface)
       - "outer" canvases hang at r ≈ 8.13, facing inward
       - "mid"   canvases hang at r ≈ 5.14, on the core's EXTERIOR, facing out
       - "inner" canvases sit at r ≈ 4.71, flush-mounted on the core's INTERIOR
         surface, facing INTO the core — a room you step inside
     So mid and inner have opposite facings despite similar radii, which is
     exactly why this is measured rather than assumed. */
  const RINGS = [
    { mesh: "PaitingsOutside_Painting_0", id: "o", quadsPer: 5 },
    { mesh: "PaitingsInside.001_Painting_0", id: "m", quadsPer: 6 },
    { mesh: "PaitingsInside_Painting_0", id: "i", quadsPer: 6 },
  ];

  /* Solid architecture, used as the occluder for the open-space test below.
     Walls_Walls_0 is the only solid geometry at painting height (6.8k verts). */
  const occluders = prims
    .filter((p) => /^Walls_(Walls|Ceilling)_0$/.test(p.name))
    .flatMap((p) => worldPositions(p.prim, p.world))
    .filter((v) => v[1] > 0.6 && v[1] < 3.2);

  /**
   * Which face of a canvas box does the viewer see?
   *
   * A largest-area heuristic is not enough: the 6-quad panels have front and
   * back faces of identical area, so it picks the back one about half the time
   * — a mirrored photograph facing into a wall. A radial sign test is not
   * enough either, because "mid" and "inner" canvases sit 0.4 m apart on
   * opposite surfaces of the same core wall and face opposite directions.
   *
   * So: measure open space. A canvas is mounted ON something, so the correct
   * display face is the one with empty gallery in front of it. Count occluder
   * vertices inside a short cylinder ahead of each candidate face and take the
   * emptiest. This is self-validating — it reads the architecture rather than
   * trusting an assumption about it.
   */
  function pickDisplayFace(faces) {
    const AHEAD_MIN = 0.05, AHEAD_MAX = 1.2, RADIUS = 0.9;
    const scored = faces.map((f) => {
      let blocked = 0;
      for (const v of occluders) {
        const d = sub(v, f.centre);
        const along = dot(d, f.n);
        if (along < AHEAD_MIN || along > AHEAD_MAX) continue;
        const perp = sub(d, scale(f.n, along));
        if (Math.hypot(perp[0], perp[1], perp[2]) < RADIUS) blocked++;
      }
      return { ...f, blocked };
    });
    // Emptiest in front wins; prefer the larger face on a tie.
    scored.sort((a, b) => a.blocked - b.blocked || b.area - a.area);
    return scored;
  }

  const slots = [];
  for (const ring of RINGS) {
    const hit = prims.find((p) => p.name === ring.mesh);
    if (!hit) throw new Error(`${ring.mesh} not found — model changed?`);
    const verts = worldPositions(hit.prim, hit.world);
    if (verts.length % (4 * ring.quadsPer) !== 0) {
      throw new Error(
        `${ring.mesh}: ${verts.length} verts is not a multiple of ${4 * ring.quadsPer} ` +
          `(${ring.quadsPer} quads per canvas) — the merged layout changed, re-inspect before trusting this.`
      );
    }
    const count = verts.length / (4 * ring.quadsPer);

    for (let c = 0; c < count; c++) {
      const quads = [];
      for (let q = 0; q < ring.quadsPer; q++) {
        const base = c * ring.quadsPer * 4 + q * 4;
        quads.push(verts.slice(base, base + 4));
      }

      /* Only the broad faces are display candidates — the thin edge strips of
         the box have areas around 0.04 m² against the face's 1.88 m². */
      const all = quads.map((quad) => {
        const e1 = sub(quad[1], quad[0]);
        const e2 = sub(quad[3], quad[0]);
        const n = normalize(cross(e1, e2));
        const centre = scale(quad.reduce(add, [0, 0, 0]), 0.25);
        const area = Math.hypot(...cross(e1, e2));
        return { quad, n, centre, area };
      });
      const maxArea = Math.max(...all.map((f) => f.area));
      const broad = all.filter((f) => f.area > maxArea * 0.5);

      const ranked = pickDisplayFace(broad);
      const face = ranked[0];

      const up = [0, 1, 0];
      const normal = normalize([face.n[0], 0, face.n[2]]); // flatten any tilt
      const right = normalize(cross(up, normal));
      const radial = normalize([face.centre[0], 0, face.centre[2]]);
      const facesOutward = dot(normal, radial) > 0;

      const ext = (axis) => {
        const ds = face.quad.map((p) => dot(p, axis));
        return Math.max(...ds) - Math.min(...ds);
      };
      const box = aabbOf(face.quad);

      slots.push({
        id: `${ring.id}${String(c).padStart(2, "0")}`,
        ring: ring.id === "o" ? "outer" : ring.id === "m" ? "mid" : "inner",
        centre: box.centre,
        normal,
        right,
        w: ext(right),
        h: ext(up),
        yaw: Math.atan2(normal[0], normal[2]),
        radius: Math.hypot(box.centre[0], box.centre[2]),
        facesOutward,
        /* diagnostics for the open-space test — `blocked` should be ~0 for the
           chosen face and clearly higher for the rejected one. */
        _blocked: face.blocked,
        _rejected: ranked.length > 1 ? ranked[1].blocked : null,
      });
    }
  }

  /* The 24 spotlight placeholders: identical fixtures on one ring, so the
     runtime only needs the ring's shape, not 24 transforms. */
  const spots = [];
  walkScene(doc.getRoot().listScenes()[0], (node, world) => {
    if (/^LightParent\|SpotTemplate/.test(node.getName())) {
      spots.push([world[12], world[13], world[14]]);
    }
  });
  const spotRing = spots.length
    ? {
        count: spots.length,
        y: spots.reduce((a, s) => a + s[1], 0) / spots.length,
        radius: spots.reduce((a, s) => a + Math.hypot(s[0], s[2]), 0) / spots.length,
      }
    : { count: 0, y: 3, radius: 6.657 };

  const all = aabbOf(prims.flatMap((p) => worldPositions(p.prim, p.world)));
  const bench = prims.filter((p) => /^Bench_/.test(p.name));
  const benchBox = bench.length
    ? aabbOf(bench.flatMap((h) => worldPositions(h.prim, h.world)))
    : null;

  const ts =
    GEN_HEADER("optimize_models.mjs", "assets/models-src/art_gallery.glb") +
    `import type { Vec3 } from "./sceneScript";

export interface GallerySlot {
  /** stable id — "o00".."o11" outer ring, "m00".."m03" mid, "i00".."i03" inner core */
  id: string;
  ring: "outer" | "mid" | "inner";
  /** centre of the canvas face, world space */
  centre: Vec3;
  /** unit normal of the face, pointing at the viewer */
  normal: Vec3;
  /** in-plane right vector — cross(up, normal) */
  right: Vec3;
  /** the frame envelope a photo must be matted into, metres */
  w: number;
  h: number;
  /** atan2(normal.x, normal.z) — the walk uses this to order the ring */
  yaw: number;
  /** distance of the centre from the rotunda axis */
  radius: number;
  /** true if the canvas looks away from the rotunda axis. The "mid" ring hangs
   *  on the core column's exterior (true); the "inner" ring is flush-mounted on
   *  its interior and faces into the core (false). Viewer positions differ. */
  facesOutward: boolean;
}

/** All ${slots.length} canvas placements, measured before the blank grey
 *  canvases were pruned. Every envelope is ${r4(slots[0].w)} × ${r4(slots[0].h)} m.
 *
 *  The rotunda is rotated a few degrees off axis (the source's root matrix
 *  carries the skew), so these yaws are NOT clean 30° multiples. Use the
 *  measured values; do not recompute them from an idealised ring. */
export const SLOTS: GallerySlot[] = [
${slots
  .map(
    (s) =>
      `  { id: "${s.id}", ring: "${s.ring}", centre: ${v4(s.centre)}, normal: ${v4(
        s.normal
      )}, right: ${v4(s.right)}, w: ${r4(s.w)}, h: ${r4(s.h)}, yaw: ${r4(s.yaw)}, radius: ${r4(
        s.radius
      )}, facesOutward: ${s.facesOutward} },`
  )
  .join("\n")}
];

/** The 24 ceiling spots were identical fixtures on one ring. The runtime pools
 *  a handful of real lights and slides them along it — moving an identical
 *  fixture is invisible, and 4 lights cost far less than 24. */
export const SPOT_RING = { count: ${spotRing.count}, y: ${r4(spotRing.y)}, radius: ${r4(
      spotRing.radius
    )} } as const;

export const GALLERY = {
  bounds: { min: ${v4(all.min)} as Vec3, max: ${v4(all.max)} as Vec3 },
${
  benchBox
    ? `  bench: { min: ${v4(benchBox.min)} as Vec3, max: ${v4(benchBox.max)} as Vec3 },\n`
    : ""
}  /** eye height the walk should hold — canvas centres sit at y ${r4(slots[0].centre[1])} */
  eyeY: ${r4(slots[0].centre[1])},
} as const;
`;

  writeFileSync(pathJoin(DATA_DIR, "galleryPlacements.ts"), ts);
  console.log(`  → src/data/galleryPlacements.ts`);
  const byRing = slots.reduce((a, s) => ((a[s.ring] = (a[s.ring] || 0) + 1), a), {});
  console.log(
    `    ${slots.length} slots (${Object.entries(byRing)
      .map(([k, v]) => `${v} ${k}`)
      .join(", ")}), envelope ${r4(slots[0].w)} × ${r4(slots[0].h)} m`
  );
  console.log(`    spot ring: ${spotRing.count} @ r=${r4(spotRing.radius)} y=${r4(spotRing.y)}`);

  /* Report the facing split, and flag any slot where the open-space test was
     not decisive — an ambiguous pick is how a mirrored, wall-facing photograph
     would ship. */
  const outward = slots.filter((s) => s.facesOutward).map((s) => s.id);
  console.log(
    `    facing: ${slots.length - outward.length} inward, ${outward.length} outward` +
      (outward.length ? ` (${outward.join(", ")})` : "")
  );
  const ambiguous = slots.filter(
    (s) => s._rejected !== null && s._blocked >= s._rejected
  );
  if (ambiguous.length) {
    console.warn(
      `    ⚠ open-space test was not decisive for ${ambiguous.length} slot(s): ` +
        ambiguous.map((s) => `${s.id}(${s._blocked} vs ${s._rejected})`).join(", ") +
        `\n      These may show mirrored or wall-facing photos. Verify with /work?slots ` +
        `before assigning photos.`
    );
  } else {
    console.log(`    open-space test decisive for all ${slots.length} slots ✓`);
  }
}

/* ================================================== stage 1+: transform ====

   Name the textures before compressing. The sources ship them all unnamed,
   which makes `gltf-transform inspect` unreadable and makes it impossible to
   target a resize by material — so derive a name from the material that uses
   each one. */
function nameTextures(doc) {
  let n = 0;
  for (const material of doc.getRoot().listMaterials()) {
    const mname = material.getName() || "mat";
    const slots = [
      ["baseColor", material.getBaseColorTexture?.()],
      ["normal", material.getNormalTexture?.()],
      ["metallicRoughness", material.getMetallicRoughnessTexture?.()],
      ["emissive", material.getEmissiveTexture?.()],
      ["occlusion", material.getOcclusionTexture?.()],
    ];
    for (const [slot, tex] of slots) {
      if (tex && !tex.getName()) {
        tex.setName(`${mname}_${slot}`);
        n++;
      }
    }
  }
  return n;
}

/** Delete every node matching `patterns`, children first. */
function pruneNodes(doc, patterns) {
  const scene = doc.getRoot().listScenes()[0];
  const doomed = [];
  walkScene(scene, (node, _world, depth) => {
    if (patterns.some((re) => re.test(node.getName()))) doomed.push({ node, depth });
  });
  // Deepest first, so disposing a parent never invalidates a queued child.
  doomed.sort((a, b) => b.depth - a.depth);
  const names = new Set();
  for (const { node } of doomed) {
    names.add(node.getName());
    // Dispose the whole subtree, deepest first.
    const stack = [];
    const gather = (n) => {
      for (const c of n.listChildren()) gather(c);
      stack.push(n);
    };
    gather(node);
    for (const n of stack) n.dispose();
  }
  return { count: doomed.length, names: [...names] };
}

async function optimize(key, sceneKind) {
  const inPath = pathJoin(SRC_DIR, `${key}.glb`);
  const outPath = pathJoin(OUT_DIR, `${key}.min.glb`);
  if (!existsSync(inPath)) {
    throw new Error(
      `missing source ${inPath}\n` +
        `  Sources are gitignored. Put the raw GLBs in assets/models-src/ ` +
        `(or set MODELS_SRC) and re-run.`
    );
  }

  console.log(`\n━━━ ${key} ━━━`);
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      "meshopt.decoder": MeshoptDecoder,
      "meshopt.encoder": MeshoptEncoder,
    });

  const doc = await io.read(inPath);
  const before = {
    bytes: statSync(inPath).size,
    verts: vertCount(doc),
    prims: primCount(doc),
    materials: doc.getRoot().listMaterials().length,
    textures: doc.getRoot().listTextures().length,
    nodes: doc.getRoot().listNodes().length,
  };

  /* -- stage 0: measure, and write the placements the runtime needs -------- */
  console.log("  stage 0 · measuring placements (before any mutation)");
  if (sceneKind === "room") measureRoom(doc);
  else measureGallery(doc);

  /* -- stage 1: name textures, then structural prune ---------------------- */
  const named = nameTextures(doc);
  const patterns = sceneKind === "room" ? ROOM_PRUNE : GALLERY_PRUNE;
  const pruned = pruneNodes(doc, patterns);
  console.log(
    `  stage 1 · named ${named} textures, deleted ${pruned.count} nodes ` +
      `(${pruned.names.slice(0, 4).join(", ")}${pruned.names.length > 4 ? ", …" : ""})`
  );
  await doc.transform(prune());
  console.log(
    `           after sweep: ${vertCount(doc).toLocaleString()} verts, ` +
      `${doc.getRoot().listMaterials().length} materials, ${
        doc.getRoot().listTextures().length
      } textures`
  );

  /* -- stage 2: geometry -------------------------------------------------- */
  console.log("  stage 2 · geometry");
  await MeshoptSimplifier.ready;
  if (sceneKind === "gallery") {
    // ~38k verts after the prune; nothing to simplify. join() collapses the
    // survivors into a handful of draw calls.
    await doc.transform(weld(), dedup(), join());
  } else {
    // Keep node names intact for runtime lookups, so no join() here.
    await doc.transform(
      weld(),
      simplify({ simplifier: MeshoptSimplifier, ratio: 0.5, error: 0.004 }),
      dedup(),
      instance({ min: 2 })
    );
  }
  console.log(
    `           ${vertCount(doc).toLocaleString()} verts, ${primCount(doc)} primitives`
  );

  /* -- stage 3: textures -------------------------------------------------- */
  if (SKIP_TEXTURES) {
    console.log("  stage 3 · textures SKIPPED (--skip-textures)");
  } else {
    console.log("  stage 3 · textures → webp");
    const sharpPattern = sceneKind === "room" ? ROOM_SHARP : GALLERY_SHARP;
    await doc.transform(
      // Surfaces you stand next to stay legible…
      textureCompress({
        encoder: sharp,
        targetFormat: "webp",
        quality: 82,
        resize: [1024, 1024],
        pattern: sharpPattern,
      }),
      // …everything else halves.
      textureCompress({
        encoder: sharp,
        targetFormat: "webp",
        quality: 78,
        resize: [512, 512],
      })
    );
  }

  /* -- stage 4: encode ---------------------------------------------------- */
  console.log("  stage 4 · resample + meshopt");
  await MeshoptEncoder.ready;
  await doc.transform(
    resample(),
    prune(),
    dedup(),
    // 'medium' on purpose: 'high' adds filters that visibly wobble large flat
    // planes, and both scenes are mostly large flat planes. meshopt() already
    // quantizes internally — do not also call quantize().
    meshopt({ encoder: MeshoptEncoder, level: "medium" })
  );

  mkdirSync(OUT_DIR, { recursive: true });
  await io.write(outPath, doc);

  const after = {
    bytes: statSync(outPath).size,
    verts: vertCount(doc),
    prims: primCount(doc),
    materials: doc.getRoot().listMaterials().length,
    textures: doc.getRoot().listTextures().length,
    nodes: doc.getRoot().listNodes().length,
  };

  const pct = (a, b) => (b === 0 ? "—" : `${(((a - b) / a) * 100).toFixed(1)}% off`);
  console.log(`  stage 5 · report`);
  console.log(`    ┌────────────┬──────────────┬──────────────┬─────────────┐`);
  const row = (label, a, b, fmt = (x) => x.toLocaleString()) =>
    console.log(
      `    │ ${label.padEnd(10)} │ ${fmt(a).padStart(12)} │ ${fmt(b).padStart(12)} │ ${pct(a, b).padStart(11)} │`
    );
  row("bytes", before.bytes, after.bytes, mb);
  row("verts", before.verts, after.verts);
  row("primitives", before.prims, after.prims);
  row("materials", before.materials, after.materials);
  row("textures", before.textures, after.textures);
  row("nodes", before.nodes, after.nodes);
  console.log(`    └────────────┴──────────────┴──────────────┴─────────────┘`);
  console.log(`    → public/models/${key}.min.glb`);

  const budget = BUDGETS[key];
  const fails = [];
  if (budget) {
    if (after.bytes > budget.bytes)
      fails.push(`bytes ${mb(after.bytes)} > ceiling ${mb(budget.bytes)}`);
    if (after.verts > budget.verts)
      fails.push(`verts ${after.verts.toLocaleString()} > ceiling ${budget.verts.toLocaleString()}`);
  }
  return { key, fails };
}

/* ==================================================================== main ==*/

/* The art gallery is OPT-IN (`--only=gallery`). The /work page is not built
   around it — that idea was dropped in favour of a conventional UI — so its
   optimized model and extracted slot placements are not committed. Everything
   needed to bring it back is still here: run `--only=gallery` and it will
   regenerate public/models/art_gallery.min.glb plus src/data/galleryPlacements.ts
   (20 canvas placements + the spotlight ring) from assets/models-src/. */
const SCENES = [
  { key: "modern_living_room", kind: "room", auto: true },
  { key: "art_gallery", kind: "gallery", auto: false },
];

const failures = [];
for (const { key, kind, auto } of SCENES) {
  const requested = ONLY && (key.includes(ONLY) || kind === ONLY);
  if (ONLY ? !requested : !auto) continue;
  const { fails } = await optimize(key, kind);
  if (fails.length) failures.push({ key, fails });
}

if (failures.length) {
  console.error(`\n✗ budget exceeded:`);
  for (const f of failures) for (const m of f.fails) console.error(`    ${f.key}: ${m}`);
  console.error(
    `\n  Tighten the prune lists or texture sizes in tools/optimize_models.mjs, ` +
      `or raise the ceiling in BUDGETS there and in src/components/scene3d/budgets.ts ` +
      `if the cost is genuinely justified.`
  );
  process.exit(1);
}
console.log(`\n✓ all scenes within budget`);
