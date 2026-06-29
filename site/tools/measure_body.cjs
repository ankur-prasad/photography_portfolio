/* Deterministic geometry probe for the camera-eye scene. Loads
   camera_body_split.glb + camera_lens.glb, replicates CameraModel's
   useNormalisedBody normalisation and useMountedLens + PLACEMENT.lens placement
   EXACTLY, then reports where the baked lens sits relative to the clean lens so
   we can size the runtime lens-plug stencil. Read-only; writes nothing. */
global.self = globalThis;
global.Image = class { set src(_v) {} };
global.document = { createElement: () => ({ getContext: () => null, style: {} }) };

const fs = require("fs");
const path = require("path");
const THREE = require("three");
const { GLTFLoader } = require("three/examples/jsm/loaders/GLTFLoader.js");

const DIR = path.join(__dirname, "..", "public", "models");
const BODY_FIT = 1.5;
const BODY_ROTATION = [0, 0.268, 0];
const BODY_OFFSET = [0, 0, -0.403];
const LENS_DIAMETER = 0.84;
const PLACEMENT_LENS = { position: [0.209, -0.109, 0.469], rotation: [-0.012, 0.001, -0.007], scale: [1.264, 1.264, 1.264] };

function load(p) {
  const buf = fs.readFileSync(p);
  return new Promise((res, rej) =>
    new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "", res, rej)
  );
}

function normBody(scene) {
  const s = scene.clone(true);
  const box = new THREE.Box3().setFromObject(s);
  const size = new THREE.Vector3(); const center = new THREE.Vector3();
  box.getSize(size); box.getCenter(center);
  const scale = BODY_FIT / size.y;
  s.rotation.set(...BODY_ROTATION);
  const rc = center.clone().applyEuler(s.rotation);
  s.scale.setScalar(scale);
  s.position.set(-rc.x * scale + BODY_OFFSET[0], -rc.y * scale + BODY_OFFSET[1], -rc.z * scale + BODY_OFFSET[2]);
  s.updateMatrixWorld(true);
  return s;
}

function mountLens(scene) {
  const s = scene.clone(true);
  s.rotation.set(0, Math.PI / 2, 0);
  s.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(s);
  const size = new THREE.Vector3(); box.getSize(size);
  s.scale.setScalar(LENS_DIAMETER / Math.max(size.x, size.y));
  const g = new THREE.Group();
  g.position.set(...PLACEMENT_LENS.position);
  g.rotation.set(...PLACEMENT_LENS.rotation);
  g.scale.set(...PLACEMENT_LENS.scale);
  g.add(s);
  g.updateMatrixWorld(true);
  return g;
}

function worldBox(root) {
  const b = new THREE.Box3().setFromObject(root);
  return { min: b.min.toArray().map((x) => +x.toFixed(3)), max: b.max.toArray().map((x) => +x.toFixed(3)) };
}

(async () => {
  const bodyG = await load(path.join(DIR, "camera_body_split.glb"));
  const lensG = await load(path.join(DIR, "camera_lens.glb"));
  const body = normBody(bodyG.scene);
  const lens = mountLens(lensG.scene);

  console.log("clean lens world bbox:", JSON.stringify(worldBox(lens)));

  // optical axis = clean lens long axis. Determine axis (XY centre) + z range from lens bbox.
  const lb = worldBox(lens);
  const AX = +((lb.min[0] + lb.max[0]) / 2).toFixed(3);
  const AY = +((lb.min[1] + lb.max[1]) / 2).toFixed(3);
  console.log("axis XY (from clean lens):", AX, AY);

  // For BODY verts: 2D density over (z, radius-from-axis). Find the lens cluster.
  const v = new THREE.Vector3();
  const zBins = {}; // key zbin -> {rmin,rmax,count}
  let n = 0;
  const rOfZ = {};
  body.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const pos = o.geometry.attributes.position;
    o.updateMatrixWorld(true);
    const step = Math.max(1, Math.floor(pos.count / 60000));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const r = Math.hypot(v.x - AX, v.y - AY);
      const zb = (Math.round(v.z * 5) / 5).toFixed(1); // 0.2 buckets
      if (!rOfZ[zb]) rOfZ[zb] = { rmin: 1e9, rmax: -1e9, cnt: 0, rlt05: 0, rlt07: 0 };
      const e = rOfZ[zb];
      if (r < e.rmin) e.rmin = r; if (r > e.rmax) e.rmax = r; e.cnt++;
      if (r < 0.5) e.rlt05++; if (r < 0.7) e.rlt07++;
      n++;
    }
  });
  console.log("body verts sampled:", n);
  console.log("z-bucket | count | rmin | rmax | (#r<0.5) | (#r<0.7)");
  Object.keys(rOfZ).map(Number).sort((a, b) => a - b).forEach((z) => {
    const e = rOfZ[z.toFixed(1)];
    console.log(`z=${z.toFixed(1).padStart(5)} | ${String(e.cnt).padStart(6)} | ${e.rmin.toFixed(2)} | ${e.rmax.toFixed(2)} | ${String(e.rlt05).padStart(5)} | ${String(e.rlt07).padStart(5)}`);
  });

  // ---- fine radius histogram at the lens-disc plane (z in [-0.25, 0.05]) ----
  // find where the lens disc ends and the body front-plate / mount ring begins.
  {
    const rh = {};
    const vv = new THREE.Vector3();
    body.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const pos = o.geometry.attributes.position; o.updateMatrixWorld(true);
      const step = Math.max(1, Math.floor(pos.count / 60000));
      for (let i = 0; i < pos.count; i += step) {
        vv.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        if (vv.z > -0.25 && vv.z < 0.05) {
          const r = Math.hypot(vv.x - AX, vv.y - AY);
          const b = (Math.floor(r * 20) / 20).toFixed(2);
          rh[b] = (rh[b] || 0) + 1;
        }
      }
    });
    console.log("\nradius histogram at lens plane (z in [-0.25,0.05]), 0.05 buckets:");
    Object.keys(rh).map(Number).sort((a, b) => a - b).forEach((r) => console.log(`  r=${r.toFixed(2)} : ${rh[r.toFixed(2)]}`));
  }

  // ---- simulate the runtime stencil (mirror CameraModel exactly) ----
  const R = 0.52, ZMIN = -0.2, ZMAX = 0.2; // keep in sync with LENS_PLUG_*
  let totalTris = 0, plugTris = 0;
  const pb = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] };
  const va = new THREE.Vector3();
  body.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index;
    o.updateMatrixWorld(true);
    const cnt = idx ? idx.count : pos.count;
    const get = (k) => (idx ? idx.getX(k) : k);
    const isPlug = (vi) => {
      va.fromBufferAttribute(pos, vi).applyMatrix4(o.matrixWorld);
      const dx = va.x - AX, dy = va.y - AY;
      return dx * dx + dy * dy < R * R && va.z > ZMIN && va.z < ZMAX;
    };
    for (let t = 0; t < cnt; t += 3) {
      totalTris++;
      const a = get(t), b = get(t + 1), c = get(t + 2);
      const votes = (isPlug(a) ? 1 : 0) + (isPlug(b) ? 1 : 0) + (isPlug(c) ? 1 : 0);
      if (votes >= 2) {
        plugTris++;
        for (const vi of [a, b, c]) {
          va.fromBufferAttribute(pos, vi).applyMatrix4(o.matrixWorld);
          for (let k = 0; k < 3; k++) { const cc = va.getComponent(k); if (cc < pb.min[k]) pb.min[k] = cc; if (cc > pb.max[k]) pb.max[k] = cc; }
        }
      }
    }
  });
  console.log(`\nSTENCIL r<${R} z[${ZMIN},${ZMAX}] -> plug tris ${plugTris} / ${totalTris} (${(100 * plugTris / totalTris).toFixed(1)}%)`);
  console.log("plug world bbox:", JSON.stringify({ min: pb.min.map((x) => +x.toFixed(3)), max: pb.max.map((x) => +x.toFixed(3)) }));
})().catch((e) => { console.error(e); process.exit(1); });
