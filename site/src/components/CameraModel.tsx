import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import {
  ANCHOR, LENS, BODY_FIT, BODY_OFFSET, BODY_ROTATION, PLACEMENT, PARTS,
  lensVisFor, mountOpenFor, sensorVisFor, shutterVisFor, shutterOpenFor, irisOpenFor,
  lensGlassDipFor, frontGlassDipFor, viewfinderIndexFor,
  smoothstep, type Part,
} from "../data/cameraScript";

/* camera_body.glb is a fused body+lens photoscan with a single shared material
   across its whole surface. The baked-in lens (a short, fat disc fused into the
   body's front face) has to be removed for the shutter/sensor beats so the
   camera can look INTO the open mount. An offline build-time split
   (camera_body_split.glb + tools/split_body_glb.cjs, classifying body vertices
   by proximity to the real camera_lens.glb mesh) was tried but only captured a
   thin edge-ring of the lens — the solid lens-front disc (the part with the
   "FE 3.5-5.6 OSS" markings) stayed in "BodyOnly" and permanently blocked the
   mount, and the half-classified remainder z-fought as it faded.

   Instead we split at runtime (useNormalisedBody): the baked lens is a compact
   cylinder centred on the optical axis at the body's front, so a solid-cylinder
   stencil (radius from the axis + a Z cut-off, in normalised model space)
   isolates the WHOLE plug cleanly — see LENS_PLUG_* below. The plug then gets
   its own material instance and is simply hidden; the clean camera_lens.glb is
   the only lens actually drawn, fading in/out per the script.

   NB: we keep loading camera_body_split.glb (NOT the original camera_body.glb).
   The offline split dropped the scan's per-part node transforms, so the two
   files normalise into DIFFERENT orientations — and every PLACEMENT/ANCHOR/SHOT
   constant is tuned to the split file's space. We just ignore its (bad)
   BodyOnly/LensPortion partition and re-bucket every triangle ourselves. */
const BODY_URL = "/models/camera_body_split.glb?v=4";
const LENS_URL = "/models/camera_lens.glb";
useGLTF.preload(BODY_URL);
useGLTF.preload(LENS_URL);

/* ---- baked-lens-plug stencil (normalised model space, same frame as PLACEMENT/ANCHOR) ----
   A body triangle is "lens plug" if it sits within LENS_PLUG_R of the optical
   axis (the +Z line through the mount centre) AND inside the Z slab
   [ZMIN, ZMAX]. The baked lens is a fat disc sitting at the mount plane (z≈0,
   reaching the axis); the camera's rear panel is also near-axis but lives back
   at z≈-1, so the Z slab keeps them apart — a one-sided z-cut would take the
   rear panel too. Everything else (grip, dials, pentaprism, mount ring,
   branding) stays "body". Verified against tools/measure_body.cjs; tunable by
   eye in ?debug via window.__lensR / __lensZmin / __lensZmax. */
const LENS_AXIS_X = 0.209;
const LENS_AXIS_Y = -0.109;
const LENS_PLUG_R = 0.52;
const LENS_PLUG_ZMIN = -0.2;
const LENS_PLUG_ZMAX = 0.2;

/* ---------- the hero photo, rendered ON PLACEMENT.zoomTarget itself ----------
   this is what actually fixes the "stuck on the viewfinder" requirement: the
   photo is a real plane in the same scene graph as the camera body, so it's
   projected through the exact same view/projection matrices as everything
   else every frame — there is no separate 2D approximation that can drift
   out of sync with the live (lagged/smoothed) viewing camera. The DOM hero
   layer (CameraExperience) only has to get close enough to crossfade into
   this before it's the only photo left. */
function ViewfinderPhoto({
  photos, indexRef, opacityRef,
}: {
  photos: string[];
  indexRef: React.MutableRefObject<number>;
  opacityRef: React.MutableRefObject<number>;
}) {
  // Suspend the canvas on ONLY the first frame (water) so first paint is fast;
  // the rest of the 2560px set streams in afterwards. Loading the heavy set
  // behind one big Suspense gate would stall the whole hero on ~8MB.
  const first = useTexture(photos[0]) as THREE.Texture;
  const texs = useRef<(THREE.Texture | null)[]>([]);
  if (texs.current.length !== photos.length) {
    texs.current = photos.map((_, i) => (i === 0 ? first : null));
  }
  useEffect(() => {
    first.colorSpace = THREE.SRGBColorSpace;
    const loader = new THREE.TextureLoader();
    let cancelled = false;
    // priority order: the eye (last — it holds under the caption) before the
    // fast middle frames, so the lingering shots are guaranteed crisp first.
    const order = [photos.length - 1, ...photos.map((_, i) => i).filter((i) => i > 0 && i < photos.length - 1)];
    for (const i of order) {
      loader.load(photos[i], (t) => {
        if (cancelled) { t.dispose(); return; }
        t.colorSpace = THREE.SRGBColorSpace;
        texs.current[i] = t;
      });
    }
    return () => { cancelled = true; };
  }, [photos, first]);

  const mesh = useRef<THREE.Mesh>(null);
  const [boxW, boxH] = PLACEMENT.zoomTarget.scale;
  const boxAspect = boxW / boxH;
  const mat = useMemo(
    // toneMapped:false — the Canvas uses ACES tone mapping (for the 3D camera
    // body lighting), which lifts + desaturates a photo's colours (deep blue
    // water → washed-out cyan). The viewfinder photo should read 1:1 with the
    // source JPEG, so opt it out of tone mapping.
    () => new THREE.MeshBasicMaterial({ map: first, transparent: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false }),
    [first]
  );
  const applied = useRef<THREE.Texture | null>(null);
  useFrame(() => {
    mat.opacity = opacityRef.current;
    let i = Math.min(photos.length - 1, Math.max(0, Math.round(indexRef.current)));
    // if the target frame hasn't streamed in yet, hold the most recent loaded
    // frame at/below it rather than flashing blank; it upgrades automatically
    // on a later frame once the texture arrives (we compare by texture object).
    while (i > 0 && !texs.current[i]) i--;
    const tex = texs.current[i] ?? first;
    if (tex === applied.current) return;
    applied.current = tex;
    mat.map = tex;
    mat.needsUpdate = true;
    /* the wrapping <group {...PLACEMENT.zoomTarget}> applies a non-uniform
       scale (the rectangle Ankur drew in AssetLab), which would otherwise
       stretch the photo to that rectangle's aspect ratio. Counteract it by
       scaling THIS unit plane (in the group's pre-scale local units) so that
       once the group scale is applied, the photo "covers" the rectangle at its
       own aspect ratio. Done per-swap since each frame has its own aspect. */
    const img = tex.image as HTMLImageElement;
    const photoAspect = img.width / img.height;
    const [worldW, worldH] = photoAspect > boxAspect ? [boxH * photoAspect, boxH] : [boxW, boxW / photoAspect];
    mesh.current?.scale.set(worldW / boxW, worldH / boxH, 1);
  });
  return (
    /* PLACEMENT.zoomTarget's rotation (hand-tuned in AssetLab, where the
       debug rectangle was double-sided so this wasn't visible) leaves the
       plane's front face pointing away from the viewing camera during the
       whole viewfinder beat — verified numerically, not guessed. Flip 180°
       so the camera sees the true front face (correct, unmirrored texture)
       instead of relying on DoubleSide alone, which would render the back
       face's mirrored UVs. */
    <mesh ref={mesh} material={mat} rotation={[0, Math.PI, 0]}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

/* ---------- leader-line label anchored to a part ---------- */
function Label({ part, show }: { part: Part; show: boolean }) {
  return (
    <Html position={ANCHOR[part.anchor]} center={false} zIndexRange={[18, 0]} pointerEvents="none">
      <div
        className={`cam-label ${part.side}`}
        style={{
          opacity: show ? 1 : 0,
          transition: "opacity 0.45s ease",
          flexDirection: part.side === "left" ? "row-reverse" : "row",
        }}
      >
        <span className="line" />
        <span className="txt">
          <b>{part.no}</b>
          {part.name} <em>→ {part.eye}</em>
        </span>
      </div>
    </Html>
  );
}

/* ---------- the normalised Sony body ---------- */
function useNormalisedBody() {
  const { scene } = useGLTF(BODY_URL);
  return useMemo(() => {
    const s = scene.clone(true);
    const box = new THREE.Box3().setFromObject(s);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const scale = BODY_FIT / size.y;
    s.rotation.set(BODY_ROTATION[0], BODY_ROTATION[1], BODY_ROTATION[2]);
    const rotatedCenter = center.clone().applyEuler(s.rotation);
    s.scale.setScalar(scale);
    s.position.set(
      -rotatedCenter.x * scale + BODY_OFFSET[0],
      -rotatedCenter.y * scale + BODY_OFFSET[1],
      -rotatedCenter.z * scale + BODY_OFFSET[2]
    );
    s.updateMatrixWorld(true);

    // ---- runtime split: isolate the baked-in lens plug from the body ----
    // The scan is one fused mesh per primitive; we re-bucket each triangle into
    // a "body" group and a "lens plug" group (solid-cylinder stencil around the
    // optical axis, see LENS_PLUG_*), give the plug its own cloned material, and
    // hand both sets back so the plug can be hidden independently. Tunables can
    // be overridden live in ?debug via window.__lensR / __lensZmin / __lensZmax.
    const w = typeof window !== "undefined" ? (window as unknown as { __lensR?: number; __lensZmin?: number; __lensZmax?: number }) : {};
    const R2 = (w.__lensR ?? LENS_PLUG_R) ** 2;
    const ZMIN = w.__lensZmin ?? LENS_PLUG_ZMIN;
    const ZMAX = w.__lensZmax ?? LENS_PLUG_ZMAX;
    const bodyMats = new Set<THREE.Material>();
    const lensMats = new Set<THREE.Material>();
    const v = new THREE.Vector3();
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry || !m.geometry.attributes.position) return;
      // clone the geometry — scene.clone(true) shares geometry with the cached
      // GLTF, and we're about to rewrite its index/groups; mutating the cache
      // would corrupt other mounts (StrictMode/HMR).
      const geo = (m.geometry = m.geometry.clone());
      const posAttr = geo.attributes.position;
      const index = geo.index;
      const count = index ? index.count : posAttr.count;
      const at = (k: number) => (index ? index.getX(k) : k);
      m.updateMatrixWorld(true);
      const isPlugVert = (vi: number) => {
        v.fromBufferAttribute(posAttr, vi).applyMatrix4(m.matrixWorld);
        const dx = v.x - LENS_AXIS_X, dy = v.y - LENS_AXIS_Y;
        return dx * dx + dy * dy < R2 && v.z > ZMIN && v.z < ZMAX;
      };
      const bodyIdx: number[] = [];
      const plugIdx: number[] = [];
      for (let t = 0; t < count; t += 3) {
        const a = at(t), b = at(t + 1), c = at(t + 2);
        const votes = (isPlugVert(a) ? 1 : 0) + (isPlugVert(b) ? 1 : 0) + (isPlugVert(c) ? 1 : 0);
        (votes >= 2 ? plugIdx : bodyIdx).push(a, b, c);
      }
      const baseMat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material;
      bodyMats.add(baseMat);
      // reorder indices (body first, then plug) and drive each range with its
      // own material via two geometry groups.
      geo.setIndex(bodyIdx.concat(plugIdx));
      geo.clearGroups();
      geo.addGroup(0, bodyIdx.length, 0);
      if (plugIdx.length) {
        const plugMat = baseMat.clone();
        lensMats.add(plugMat);
        geo.addGroup(bodyIdx.length, plugIdx.length, 1);
        m.material = [baseMat, plugMat];
      } else {
        m.material = baseMat;
      }
    });
    return { node: s, mats: Array.from(bodyMats), lensMats: Array.from(lensMats) };
  }, [scene]);
}

/* ---------- the clean lens, oriented + scaled, left at its raw clone origin ----------
   placement (position/rotation/scale) is applied by the wrapping <group> in
   render using PLACEMENT.lens, hand-tuned in the AssetLab sandbox — matching
   how AssetLab itself measured this part (inner node un-centred, outer
   <group> carrying the placement). */
function useMountedLens() {
  const { scene } = useGLTF(LENS_URL);
  return useMemo(() => {
    const s = scene.clone(true);
    // optical axis (local +X long axis) → world +Z, front element toward +Z.
    s.rotation.set(0, Math.PI / 2, 0);
    const box = new THREE.Box3().setFromObject(s);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = LENS.diameter / Math.max(size.x, size.y);
    s.scale.setScalar(scale);
    const mats = new Set<THREE.Material>();
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material) {
        const swap = (mat: THREE.Material) => {
          // this asset's single material is alphaMode=BLEND with
          // KHR_materials_transmission (a real "glass" look) — zeroing
          // transmission isn't enough to stop it reading as see-through, so
          // rebuild it as a plain opaque MeshStandardMaterial that has no
          // blend/transmission code path at all. setFade (below) re-adds
          // transparency only for the brief intro/outro fade.
          const src = mat as THREE.MeshPhysicalMaterial;
          const fresh = new THREE.MeshStandardMaterial({
            map: src.map,
            normalMap: src.normalMap,
            roughnessMap: src.roughnessMap,
            metalnessMap: src.metalnessMap,
            color: src.color,
            roughness: src.roughness,
            metalness: src.metalness,
          });
          mats.add(fresh);
          return fresh;
        };
        m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material);
      }
    });
    return { node: s, mats: Array.from(mats) };
  }, [scene]);
}

/* ---------- built iris (the lens glass is empty) ---------- */
function Iris({
  openRef, frameMat, bladeMat,
}: {
  openRef: React.MutableRefObject<number>;
  frameMat: THREE.Material; bladeMat: THREE.Material;
}) {
  const N = 9;
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const d = 0.3 + openRef.current * 0.16; // inner edge (= aperture radius) = d − height/2
    for (const m of refs.current) if (m) m.position.y = d;
  });
  return (
    <group>
      <mesh material={frameMat}>
        <ringGeometry args={[0.32, 0.36, 48]} />
      </mesh>
      {Array.from({ length: N }).map((_, i) => (
        <group key={i} rotation={[0, 0, (i / N) * Math.PI * 2]}>
          <mesh ref={(r) => (refs.current[i] = r)} material={bladeMat} position={[0, 0.3, i * 0.0004]}>
            <boxGeometry args={[0.42, 0.52, 0.004]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ---------- built focal-plane shutter (curtain blades) — not in the scan ---------- */
function ShutterMech({
  slatMat, openRef,
}: {
  slatMat: THREE.Material; openRef: React.MutableRefObject<number>;
}) {
  const top = useRef<THREE.Group>(null);
  const bot = useRef<THREE.Group>(null);
  useFrame(() => {
    const o = openRef.current;
    if (top.current) top.current.position.y = o * 0.2;
    if (bot.current) bot.current.position.y = -o * 0.2;
  });
  const slats = [0, 1, 2, 3];
  return (
    <group>
      <group ref={top}>
        {slats.map((i) => (
          <mesh key={`t${i}`} material={slatMat} position={[0, 0.026 + i * 0.052, i * 0.0006]}>
            <boxGeometry args={[0.64, 0.052, 0.004]} />
          </mesh>
        ))}
      </group>
      <group ref={bot}>
        {slats.map((i) => (
          <mesh key={`b${i}`} material={slatMat} position={[0, -0.026 - i * 0.052, i * 0.0006]}>
            <boxGeometry args={[0.64, 0.052, 0.004]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export interface CameraModelProps {
  progress: React.MutableRefObject<number>;
  beat: number;
  photos: string[];
  debug?: boolean;
}

export default function CameraModel({ progress, beat, photos, debug }: CameraModelProps) {
  const root = useRef<THREE.Group>(null);
  const body = useNormalisedBody();
  const lens = useMountedLens();
  const cur = useRef(0);
  const lastLog = useRef(0);

  const viewfinderPhotoOpacity = useRef(1);
  const viewfinderIndex = useRef(0);
  const shutterOpen = useRef(0);
  const irisOpen = useRef(0.7);

  /* materials for the built parts */
  const M = useMemo(() => ({
    // built front element — the scanned lens mesh's own glass is opaque
    // (no usable separate glass submesh to re-material), so this disc sits
    // just in front of it. Plain opacity-faded clearcoat (not transmission —
    // that rendered as a near-opaque void against this scene's dim
    // background instead of fading predictably) reads as coated glass via
    // gloss + env reflections alone.
    frontGlass: new THREE.MeshPhysicalMaterial({
      color: 0x0a0a0d, metalness: 0.05, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04,
      envMapIntensity: 1.6, transparent: true, opacity: 0,
    }),
    // lens interior
    irisGlow: new THREE.MeshStandardMaterial({ color: 0x120a04, emissive: 0xf0883e, emissiveIntensity: 0.4, metalness: 0, roughness: 1, transparent: true, opacity: 0 }),
    irisFrame: new THREE.MeshStandardMaterial({ color: 0x6a4a2a, metalness: 0.9, roughness: 0.3, transparent: true, opacity: 0 }),
    irisBlade: new THREE.MeshStandardMaterial({ color: 0x52555e, metalness: 0.95, roughness: 0.22, transparent: true, opacity: 0 }),
    // open mount interior — covers the body cap when the lens is off
    cap: new THREE.MeshStandardMaterial({ color: 0x060607, metalness: 0.35, roughness: 0.85, transparent: true, opacity: 0 }),
    well: new THREE.MeshStandardMaterial({ color: 0x0a0a0c, metalness: 0.5, roughness: 0.6, transparent: true, opacity: 0 }),
    // built full-frame sensor
    sensorRim: new THREE.MeshStandardMaterial({ color: 0x050505, emissive: 0x000000, emissiveIntensity: 0, metalness: 0.3, roughness: 0.4, transparent: true, opacity: 0 }),
    sensor: new THREE.MeshStandardMaterial({ color: 0x8a2be2, emissive: 0x5a1f9a, emissiveIntensity: 0.45, metalness: 0.7, roughness: 0.16, transparent: true, opacity: 0 }),
    // built shutter
    shutterFrame: new THREE.MeshStandardMaterial({ color: 0x111114, metalness: 0.6, roughness: 0.4, transparent: true, opacity: 0 }),
    shutterSlat: new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.55, roughness: 0.5, transparent: true, opacity: 0 }),
  }), []);

  useFrame((_, dt) => {
    /* the body/lens GLB scans carry baked-in alpha (scan holes, decal cutouts)
       that the renderer ignores while a material is opaque. Forcing
       transparent=true permanently — as this used to do — makes those holes
       show through as "see through" patches even at full opacity. Only flip
       a material transparent for the brief window it's actually fading. */
    const setFade = (mats: THREE.Material[], v: number) => {
      const t = v < 1;
      for (const m of mats) {
        m.opacity = v;
        // Toggling `transparent` at runtime REQUIRES needsUpdate — without it
        // three.js can keep rendering the material with its old (opaque) program
        // so opacity is ignored and a "hidden" (opacity 0) mesh renders at full
        // strength. It's load-order-flaky (looks fine one refresh, the lens is
        // back the next), which is exactly the "lens won't go away" bug. Only
        // recompile on the actual flip so it stays cheap.
        if (m.transparent !== t) { m.transparent = t; m.needsUpdate = true; }
        // a fading-out mesh that keeps writing depth still occludes whatever
        // sits behind it (e.g. the shutter/sensor behind the "removed" lens)
        // even at opacity 0 — and the lens scan in particular is built from
        // overlapping photogrammetry fragments, which self-z-fight once
        // transparent. Only write depth once fully opaque.
        m.depthWrite = v >= 1;
      }
    };
    const setOpacity = (m: THREE.Material, v: number) => {
      m.opacity = v;
      m.depthWrite = v >= 1;
    };

    // Track scroll TIGHTLY. Lenis already eases the scroll position itself
    // (lerp 0.09), so a heavy second smoothing here just adds lag — and that
    // lag let the lens-on state linger into the shutter/sensor beats (the model
    // trailing the scroll, so you still saw the lens where the open mount
    // should be). Keep only a hair of smoothing to absorb sub-frame jitter.
    cur.current += (progress.current - cur.current) * (debug ? 1 : Math.min(1, dt * 18));
    const p = cur.current;

    const lensVis = lensVisFor(p);
    const mountOpen = mountOpenFor(p);
    const sensorVis = sensorVisFor(p);
    const shutterVis = shutterVisFor(p);
    const lensGlassDip = lensGlassDipFor(p);
    const frontGlassDip = frontGlassDipFor(p);

    // the WHOLE A7R body scan stays fully opaque the entire act — the body is
    // its own complete asset and we never punch a hole in it. (The runtime
    // split still exists so ?paintlens can visualise the fused-lens region, but
    // in normal render the "plug" is just part of the body like everything
    // else.) The built shutter/sensor are drawn in FRONT of the body's mount;
    // the clean camera_lens.glb is what actually comes off for those beats.
    setFade(body.mats, 1);
    if (debug && typeof window !== "undefined" && window.location.search.includes("paintlens")) {
      // visualise what the runtime stencil classified as lens plug
      for (const m of body.lensMats) {
        const mat = m as THREE.MeshStandardMaterial;
        mat.color.set(0xff0000);
        if (mat.emissive) { mat.emissive.set(0xff0000); mat.emissiveIntensity = 1; }
        mat.opacity = 1;
        mat.transparent = false;
        mat.depthWrite = true;
      }
    } else {
      setFade(body.lensMats, 1);
    }
    // lens + its optics fade off for the internal beats — the barrel/glass
    // itself is also kept dipped (separately from lensVis, see
    // lensGlassDipFor) so the opaque front element never fully hides the
    // iris behind it. Narrow/windowed: the barrel is one continuous tube
    // wall, so dipping it for longer would make its SIDES translucent too,
    // exposing the iris/mount hardware from any side/¾ angle — not just the
    // dead-on front opening.
    setFade(lens.mats, lensVis * (1 - lensGlassDip));
    // Belt-and-suspenders: when the lens is fully off, hide the whole node
    // outright. Opacity 0 alone proved unreliable for the clean lens (the
    // transparent-flip-without-recompile bug above made it flash back to
    // full opacity on some loads); `visible = false` can never be ignored.
    lens.node.visible = lensVis > 0;
    // the dedicated front-cap disc dips separately (and more, by default) —
    // it's a thin disc, not a tube wall, so staying translucent from any
    // angle is safe and is what keeps the front of the lens from ever
    // reading as flat opaque black.
    setOpacity(M.frontGlass, lensVis * (1 - frontGlassDip));
    setOpacity(M.irisGlow, lensVis);
    setOpacity(M.irisFrame, lensVis);
    setOpacity(M.irisBlade, lensVis);
    // cap-cover is ALWAYS on so the body cap is never seen
    setOpacity(M.cap, 1);
    setOpacity(M.well, 0.4 + 0.6 * mountOpen);
    setOpacity(M.sensorRim, sensorVis);
    setOpacity(M.sensor, sensorVis);
    setOpacity(M.shutterFrame, shutterVis);
    setOpacity(M.shutterSlat, shutterVis);

    if (debug && performance.now() - lastLog.current > 500) {
      lastLog.current = performance.now();
      console.log(
        `[camera-debug] p=${p.toFixed(3)} lensVis=${lensVis.toFixed(3)} ` +
        `bodyLensOpacity=${body.lensMats[0]?.opacity} bodyLensTransparent=${body.lensMats[0]?.transparent} ` +
        `lensOpacity=${lens.mats[0]?.opacity} lensTransparent=${lens.mats[0]?.transparent}`
      );
    }

    // the viewfinder photo: it's the hero now — fully visible from p=0
    // (the viewing camera starts framed tight on it, see SHOTS[0]), out once
    // the lens beat takes over. It also flips through the act-opening flipbook
    // (water → … → eye) and lands/holds on the eye at EYE_LAND_P.
    viewfinderPhotoOpacity.current = 1 - smoothstep(0.16, 0.24, p);
    viewfinderIndex.current = viewfinderIndexFor(p, photos.length);
    shutterOpen.current = shutterOpenFor(p);
    irisOpen.current = irisOpenFor(p);

    if (root.current) root.current.rotation.y = Math.sin(p * 0.5) * 0.012;
  });

  const showLabel = (b: number) => beat === b;

  return (
    <group ref={root}>
      <primitive object={body.node} />
      {!(typeof window !== "undefined" && window.location.search.includes("nolens")) && (
        <group {...PLACEMENT.lens}>
          <primitive object={lens.node} />
          <mesh material={M.frontGlass} position={[0, 0, 0.522]}>
            <circleGeometry args={[0.36, 48]} />
          </mesh>
        </group>
      )}

      {/* lens interior — glow + iris, sitting inside the lens (behind the front glass) */}
      <group {...PLACEMENT.iris}>
        <mesh material={M.irisGlow} position={[0, 0, -0.18]}>
          <circleGeometry args={[0.2, 40]} />
        </mesh>
        <Iris openRef={irisOpen} frameMat={M.irisFrame} bladeMat={M.irisBlade} />
      </group>

      {/* dark plate that hides the body cap and fills the mount opening */}
      <group {...PLACEMENT.capCover}>
        <mesh material={M.cap}>
          <circleGeometry args={[0.54, 56]} />
        </mesh>
        {/* shallow sensor well, slightly proud */}
        <mesh material={M.well} position={[0, 0, 0.006]}>
          <ringGeometry args={[0.38, 0.5, 48]} />
        </mesh>
      </group>

      {/* the built full-frame sensor — cyan cover-glass rim + purple silicon */}
      <group {...PLACEMENT.sensor}>
        <mesh material={M.sensorRim}>
          <planeGeometry args={[0.7, 0.47]} />
        </mesh>
        <mesh material={M.sensor} position={[0, 0, 0.003]}>
          <planeGeometry args={[0.66, 0.44]} />
        </mesh>
      </group>

      {/* focal-plane shutter, just in front of the sensor */}
      <group {...PLACEMENT.shutter}>
        <ShutterMech slatMat={M.shutterSlat} openRef={shutterOpen} />
      </group>

      {/* the hero photo, pinned to the viewfinder eyepiece */}
      <group {...PLACEMENT.zoomTarget}>
        <ViewfinderPhoto photos={photos} indexRef={viewfinderIndex} opacityRef={viewfinderPhotoOpacity} />
      </group>

      {PARTS.map((part) => (
        <Label key={part.no} part={part} show={showLabel(part.beat)} />
      ))}

      {debug && typeof window !== "undefined" && window.location.search.includes("spheres") &&
        Object.entries(ANCHOR).map(([k, v]) => (
          <mesh key={k} position={v}>
            <sphereGeometry args={[0.03, 12, 12]} />
            <meshBasicMaterial color={k === "lensFront" ? "#ff4040" : "#40ff80"} />
          </mesh>
        ))}

    </group>
  );
}
