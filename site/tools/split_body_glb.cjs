/* Splits public/models/camera_body.glb (a fused body+lens photoscan, single
   shared material) into two independent node groups — "BodyOnly" and
   "LensPortion" — so CameraModel can fade the baked-in lens shape on its own
   without touching the rest of the body.

   Classification: a body vertex is "lens" if it's within PROXIMITY_THRESHOLD
   of any vertex of the REAL camera_lens.glb mesh, transformed into the exact
   same world space it renders in (useMountedLens's rotate+scale, then
   CameraModel's PLACEMENT.lens group transform). This replaced an earlier
   synthetic-cylinder heuristic (radius from a fixed axis + a Z cutoff) that
   turned out to have no clean separation from the body in radius/Z space —
   verified by histogramming actual vertex radii, which showed a continuous
   spread with no gap. Following the real lens's own shape as a 3D stencil is
   far more reliable. Re-run this if camera_body.glb, camera_lens.glb, or the
   placement constants in cameraScript.ts (BODY_FIT/BODY_ROTATION/BODY_OFFSET,
   LENS.diameter, PLACEMENT.lens) ever change. */
global.self = globalThis;
class FakeImage { constructor() {} set src(_v) {} }
global.Image = FakeImage;
global.document = { createElement: () => ({ getContext: () => null, style: {} }) };

const fs = require("fs");
const path = require("path");
const THREE = require("three");
const { GLTFLoader } = require("three/examples/jsm/loaders/GLTFLoader.js");

const SRC_DIR = process.argv[2] || ".";
const OUT_DIR = process.argv[3] || ".";
const SRC = path.join(SRC_DIR, "camera_body.glb");
const LENS_SRC = path.join(SRC_DIR, "camera_lens.glb");
const OUT = path.join(OUT_DIR, "camera_body_split.glb");

function readGLB(p) {
  const buf = fs.readFileSync(p);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString("utf8"));
  let offset = 20 + jsonLen;
  let bin = null;
  while (offset < buf.length) {
    const chunkLen = buf.readUInt32LE(offset);
    const chunkType = buf.readUInt32LE(offset + 4);
    const chunkData = buf.slice(offset + 8, offset + 8 + chunkLen);
    if (chunkType === 0x004e4942) bin = chunkData; // "BIN\0"
    offset += 8 + chunkLen;
  }
  return { json, bin };
}

function loadGLTF(p) {
  const buf = fs.readFileSync(p);
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", resolve, reject);
  });
}

const { json, bin } = readGLB(SRC);

// ---- normalization transform, matching CameraModel's useNormalisedBody exactly ----
const BODY_FIT = 1.5;
const ry = 0.268;
const BODY_OFFSET = [0, 0, -0.403];
function applyEulerY(v, ry) {
  const cos = Math.cos(ry), sin = Math.sin(ry);
  return [v[0] * cos + v[2] * sin, v[1], -v[0] * sin + v[2] * cos];
}
const primMeta = [
  { meshIdx: 0, posAcc: 0, idxAcc: 3 },
  { meshIdx: 1, posAcc: 6, idxAcc: 4 },
  { meshIdx: 2, posAcc: 9, idxAcc: 5 },
];

// combined raw bbox across the 3 position accessors (uses accessor min/max, exact)
let rmin = [Infinity, Infinity, Infinity], rmax = [-Infinity, -Infinity, -Infinity];
for (const { posAcc } of primMeta) {
  const a = json.accessors[posAcc];
  for (let i = 0; i < 3; i++) { rmin[i] = Math.min(rmin[i], a.min[i]); rmax[i] = Math.max(rmax[i], a.max[i]); }
}
const size = [rmax[0] - rmin[0], rmax[1] - rmin[1], rmax[2] - rmin[2]];
const center = [(rmax[0] + rmin[0]) / 2, (rmax[1] + rmin[1]) / 2, (rmax[2] + rmin[2]) / 2];
const scale = BODY_FIT / size[1];
const rotatedCenter = applyEulerY(center, ry);
const pos = [
  -rotatedCenter[0] * scale + BODY_OFFSET[0],
  -rotatedCenter[1] * scale + BODY_OFFSET[1],
  -rotatedCenter[2] * scale + BODY_OFFSET[2],
];
function worldOf(v) {
  const r = applyEulerY(v, ry);
  return [r[0] * scale + pos[0], r[1] * scale + pos[1], r[2] * scale + pos[2]];
}

// ---- lens classification: proximity to the real, correctly-placed lens mesh ----
const PROXIMITY_THRESHOLD = 0.15;
const GRID_CELL = 0.05;

async function buildLensGrid() {
  const lensGltf = await loadGLTF(LENS_SRC);
  const lensScene = lensGltf.scene;
  // mirror useMountedLens exactly
  lensScene.rotation.set(0, Math.PI / 2, 0);
  lensScene.updateMatrixWorld(true);
  const lensBox = new THREE.Box3().setFromObject(lensScene);
  const lensSize = new THREE.Vector3();
  lensBox.getSize(lensSize);
  const LENS_DIAMETER = 0.84; // LENS.diameter in cameraScript.ts
  lensScene.scale.setScalar(LENS_DIAMETER / Math.max(lensSize.x, lensSize.y));
  // mirror the wrapping <group {...PLACEMENT.lens}>
  const group = new THREE.Group();
  group.position.set(0.209, -0.109, 0.469);
  group.rotation.set(-0.012, 0.001, -0.007);
  group.scale.set(1.264, 1.264, 1.264);
  group.add(lensScene);
  group.updateMatrixWorld(true);

  const grid = new Map();
  const key = (x, y, z) => `${Math.floor(x / GRID_CELL)},${Math.floor(y / GRID_CELL)},${Math.floor(z / GRID_CELL)}`;
  const v = new THREE.Vector3();
  lensScene.traverse((o) => {
    if (!o.isMesh) return;
    o.updateMatrixWorld(true);
    const posAttr = o.geometry.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i).applyMatrix4(o.matrixWorld);
      const k = key(v.x, v.y, v.z);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push([v.x, v.y, v.z]);
    }
  });
  return grid;
}

function minDistToLens(grid, x, y, z, maxR) {
  const cx = Math.floor(x / GRID_CELL), cy = Math.floor(y / GRID_CELL), cz = Math.floor(z / GRID_CELL);
  let best = Infinity;
  const range = Math.ceil(maxR / GRID_CELL);
  for (let dx = -range; dx <= range; dx++)
    for (let dy = -range; dy <= range; dy++)
      for (let dz = -range; dz <= range; dz++) {
        const arr = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
        if (!arr) continue;
        for (const v of arr) {
          const d = Math.hypot(v[0] - x, v[1] - y, v[2] - z);
          if (d < best) best = d;
        }
      }
  return best;
}

function readPositions(accIdx) {
  const acc = json.accessors[accIdx];
  const bv = json.bufferViews[acc.bufferView];
  const stride = bv.byteStride || 12;
  const start = bv.byteOffset + (acc.byteOffset || 0);
  const out = [];
  for (let i = 0; i < acc.count; i++) {
    const o = start + i * stride;
    out.push([bin.readFloatLE(o), bin.readFloatLE(o + 4), bin.readFloatLE(o + 8)]);
  }
  return out;
}
function readIndices(accIdx) {
  const acc = json.accessors[accIdx];
  const bv = json.bufferViews[acc.bufferView];
  const start = bv.byteOffset + (acc.byteOffset || 0);
  const out = new Uint32Array(acc.count);
  for (let i = 0; i < acc.count; i++) out[i] = bin.readUInt32LE(start + i * 4);
  return out;
}

async function main() {
const lensGrid = await buildLensGrid();
function isLensVertex(v) {
  const w = worldOf(v);
  return minDistToLens(lensGrid, w[0], w[1], w[2], PROXIMITY_THRESHOLD) < PROXIMITY_THRESHOLD;
}

const splitResults = primMeta.map(({ posAcc, idxAcc }) => {
  const positions = readPositions(posAcc);
  const indices = readIndices(idxAcc);
  const vertLensFlag = positions.map(isLensVertex);
  const lensIdx = [];
  const bodyIdx = [];
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t], b = indices[t + 1], c = indices[t + 2];
    const votes = (vertLensFlag[a] ? 1 : 0) + (vertLensFlag[b] ? 1 : 0) + (vertLensFlag[c] ? 1 : 0);
    const target = votes >= 2 ? lensIdx : bodyIdx;
    target.push(a, b, c);
  }
  return { lensIdx, bodyIdx, totalTris: indices.length / 3 };
});

splitResults.forEach((r, i) => {
  console.log(`mesh ${i}: ${r.totalTris} tris -> lens ${r.lensIdx.length / 3}, body ${r.bodyIdx.length / 3}`);
});

// ---- build new buffer chunk: append new index arrays after the original bin ----
const newChunks = []; // { data: Buffer, byteOffsetInNew: number }
let cursor = bin.length;
// pad bin to 4-byte boundary before appending new data
const pad0 = (4 - (cursor % 4)) % 4;
const newBufferParts = [bin];
if (pad0) newBufferParts.push(Buffer.alloc(pad0));
cursor += pad0;

const newBufferViews = [];
const newAccessors = [];

function appendIndexArray(arr) {
  const buf = Buffer.alloc(arr.length * 4);
  for (let i = 0; i < arr.length; i++) buf.writeUInt32LE(arr[i], i * 4);
  const byteOffset = cursor;
  newBufferParts.push(buf);
  cursor += buf.length;
  const pad = (4 - (cursor % 4)) % 4;
  if (pad) { newBufferParts.push(Buffer.alloc(pad)); cursor += pad; }
  const bvIdx = json.bufferViews.length + newBufferViews.length;
  newBufferViews.push({ buffer: 0, byteOffset, byteLength: buf.length, target: 34963 });
  const accIdx = json.accessors.length + newAccessors.length;
  newAccessors.push({ type: "SCALAR", componentType: 5125, count: arr.length, bufferView: bvIdx, byteOffset: 0 });
  return accIdx;
}

const bodyIdxAccessors = splitResults.map((r) => appendIndexArray(r.bodyIdx));
const lensIdxAccessors = splitResults.map((r) => appendIndexArray(r.lensIdx));

json.bufferViews.push(...newBufferViews);
json.accessors.push(...newAccessors);

// ---- duplicate material 0 so body/lens portions get independent material instances ----
const matClone = JSON.parse(JSON.stringify(json.materials[0]));
matClone.name = (matClone.name || "material") + "_lensPortion";
const lensMatIdx = json.materials.length;
json.materials.push(matClone);

// ---- new meshes: BodyOnly (material 0) / LensPortion (material lensMatIdx) ----
function attrsFor(meshIdx) {
  return json.meshes[meshIdx].primitives[0].attributes;
}
const bodyMesh = {
  name: "BodyOnly",
  primitives: primMeta.map(({ meshIdx }, i) => ({
    attributes: attrsFor(meshIdx),
    indices: bodyIdxAccessors[i],
    material: 0,
  })),
};
const lensMesh = {
  name: "LensPortion",
  primitives: primMeta.map(({ meshIdx }, i) => ({
    attributes: attrsFor(meshIdx),
    indices: lensIdxAccessors[i],
    material: lensMatIdx,
  })),
};
const bodyMeshIdx = json.meshes.length;
json.meshes.push(bodyMesh);
const lensMeshIdx = json.meshes.length;
json.meshes.push(lensMesh);

// ---- new nodes, wired in place of the old 3 part-nodes under the parent node ----
const bodyNodeIdx = json.nodes.length;
json.nodes.push({ name: "BodyOnly", mesh: bodyMeshIdx });
const lensNodeIdx = json.nodes.length;
json.nodes.push({ name: "LensPortion", mesh: lensMeshIdx });

// parent node is index 1 ("cam2.obj.cleaner.materialmerger.gles") with children [2,3,4]
const parentNode = json.nodes[1];
console.log("old parent children:", parentNode.children);
parentNode.children = [bodyNodeIdx, lensNodeIdx];

// ---- update buffer length, write out ----
const newBufferLength = Buffer.concat(newBufferParts).length;
json.buffers[0].byteLength = newBufferLength;

const newBin = Buffer.concat(newBufferParts);
const jsonStr = JSON.stringify(json);
const jsonPad = (4 - (jsonStr.length % 4)) % 4;
const jsonBuf = Buffer.concat([Buffer.from(jsonStr, "utf8"), Buffer.alloc(jsonPad, 0x20)]);

const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); // "glTF"
header.writeUInt32LE(2, 4);
const totalLength = 12 + 8 + jsonBuf.length + 8 + newBin.length;
header.writeUInt32LE(totalLength, 8);

const jsonChunkHeader = Buffer.alloc(8);
jsonChunkHeader.writeUInt32LE(jsonBuf.length, 0);
jsonChunkHeader.writeUInt32LE(0x4e4f534a, 4); // "JSON"

const binChunkHeader = Buffer.alloc(8);
binChunkHeader.writeUInt32LE(newBin.length, 0);
binChunkHeader.writeUInt32LE(0x004e4942, 4); // "BIN\0"

const out = Buffer.concat([header, jsonChunkHeader, jsonBuf, binChunkHeader, newBin]);
fs.writeFileSync(OUT, out);
console.log("wrote", OUT, out.length, "bytes");
}

main().catch((e) => { console.error(e); process.exit(1); });
