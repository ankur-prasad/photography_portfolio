#!/usr/bin/env node
/* ============================================================================
   verify_models — assert the optimized GLBs contain what the runtime expects.

   The scenes are driven by measured constants, so a silent change in a model
   (a renamed node, a pruned-too-far mesh, a painting that survived) would show
   up as a subtly wrong render rather than an error. This checks the invariants
   the runtime actually depends on, and exits non-zero if any fail.

     node tools/verify_models.mjs
   ========================================================================== */

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { statSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MODELS = join(SITE, "public", "models");

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });

const results = [];
const check = (name, pass, detail = "") => results.push({ name, pass, detail });

function nodeNames(doc) {
  return new Set(doc.getRoot().listNodes().map((n) => n.getName()));
}
function meshNames(doc) {
  return new Set(doc.getRoot().listMeshes().map((m) => m.getName()));
}
function verts(doc) {
  let n = 0;
  for (const m of doc.getRoot().listMeshes())
    for (const p of m.listPrimitives()) n += p.getAttribute("POSITION")?.getCount() ?? 0;
  return n;
}

/* ---------------------------------------------------------- living room --- */
{
  const path = join(MODELS, "modern_living_room.min.glb");
  const doc = await io.read(path);
  const names = nodeNames(doc);
  const bytes = statSync(path).size;

  // The whole point of the /prints scene: the painting must be gone, so the
  // runtime can hang its own to-scale print in that spot.
  const survivors = [...names].filter((n) => /^Painting/.test(n));
  check("room: painting removed", survivors.length === 0, survivors.join(", "));

  // …but the room the print hangs in must still be there.
  for (const keep of [
    "Plane_Wall2_0",
    "Plane_Floor_0",
    "Plane_Walls_0",
    "Couch_Couch_0",
    "Rug_Rug_0",
    "Window_Window_0",
    "WoodCoffeTable_WoodCoffeTable_0",
    "ModernLamps_ModernLamps_0",
  ]) {
    check(`room: kept ${keep}`, names.has(keep));
  }

  // Materials shared with the painting must NOT have been swept up with it.
  const mats = new Set(doc.getRoot().listMaterials().map((m) => m.getName()));
  check("room: shared 'Black' material intact", mats.has("Black"));
  check("room: shared 'GlassD1' material intact", mats.has("GlassD1"));
  // …while the painting's own exclusive material is gone.
  check("room: 'Painting' material pruned", !mats.has("Painting"));

  check("room: within byte ceiling", bytes <= 8 * 1024 * 1024, `${(bytes / 1048576).toFixed(2)} MB`);
  check("room: within vert ceiling", verts(doc) <= 200_000, verts(doc).toLocaleString());
}

/* The art gallery scene was dropped, so its model and slot placements are no
   longer committed. `npm run models:optimize -- --only=gallery` regenerates
   them, and this file's git history has the checks that covered them. */

/* ----------------------------------------------------------------- report -- */
const failed = results.filter((r) => !r.pass);
for (const r of results) {
  console.log(`${r.pass ? "  ✓" : "  ✗"} ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
}
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
