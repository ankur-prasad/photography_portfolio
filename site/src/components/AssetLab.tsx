import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls, TransformControls, useGLTF, Environment, Grid, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  BODY_FIT, BODY_OFFSET, BODY_ROTATION, LENS, ANCHOR, SENSOR_Z, PLACEMENT, SHOTS,
  lerp, smoothstep, shotToPose, type Shot, type Vec3,
} from "../data/cameraScript";

/* ============================================================================
   AssetLab — a sandbox at /?lab to place the built parts onto the camera body
   by hand. Orbit to view from any angle, click a part to select it, then drag
   the gizmo (translate / rotate / scale). Hit Export to copy every transform.
   Transforms persist in localStorage so a reload keeps your work.

   Two tabs:
   - Parts: place the built mesh parts (+ the body itself) against the model.
   - Framing: scrub/edit the viewing-camera flight (SHOTS) that drives the
     real scroll experience, previewing it live against the same body.
   ========================================================================== */

const BODY_URL = "/models/camera_body.glb";
const LENS_URL = "/models/camera_lens.glb";
useGLTF.preload(BODY_URL);
useGLTF.preload(LENS_URL);

const LS_KEY = "assetlab.transforms.v1";
const SHOTS_LS_KEY = "assetlab.shots.v1";

type Tab = "parts" | "framing";
type Mode = "translate" | "rotate" | "scale";
type TF = { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] };

/* initial transforms = current values from the live experience */
const INITIAL: Record<string, TF> = {
  body: { position: [...BODY_OFFSET], rotation: [...BODY_ROTATION], scale: [1, 1, 1] },
  capCover: { position: [ANCHOR.mount[0], ANCHOR.mount[1], SENSOR_Z], rotation: [0, 0, 0], scale: [1, 1, 1] },
  sensor: { position: [ANCHOR.mount[0], ANCHOR.mount[1], SENSOR_Z + 0.012], rotation: [0, 0, 0], scale: [1, 1, 1] },
  shutter: { position: [ANCHOR.mount[0], ANCHOR.mount[1], SENSOR_Z + 0.045], rotation: [0, 0, 0], scale: [1, 1, 1] },
  iris: { position: [ANCHOR.mount[0], ANCHOR.mount[1], 1.48], rotation: [0, 0, 0], scale: [0.6, 0.6, 0.6] },
  zoomTarget: { ...PLACEMENT.zoomTarget },
};

function loadSaved(): Record<string, TF> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...INITIAL, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return INITIAL;
}

function loadSavedShots(): Shot[] {
  try {
    const raw = localStorage.getItem(SHOTS_LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return JSON.parse(JSON.stringify(SHOTS));
}

/* sample an arbitrary (editable) shot list the same way cameraScript's
   samplePose does for the real, fixed SHOTS export */
function sampleShotsAt(shots: Shot[], p: number): { pos: Vec3; target: Vec3 } {
  if (p <= shots[0].p) return shotToPose(shots[0]);
  if (p >= shots[shots.length - 1].p) return shotToPose(shots[shots.length - 1]);
  for (let i = 0; i < shots.length - 1; i++) {
    const a = shots[i], b = shots[i + 1];
    if (p >= a.p && p <= b.p) {
      const e = smoothstep(a.p, b.p, p);
      const pa = shotToPose(a), pb = shotToPose(b);
      return {
        pos: [lerp(pa.pos[0], pb.pos[0], e), lerp(pa.pos[1], pb.pos[1], e), lerp(pa.pos[2], pb.pos[2], e)],
        target: [lerp(pa.target[0], pb.target[0], e), lerp(pa.target[1], pb.target[1], e), lerp(pa.target[2], pb.target[2], e)],
      };
    }
  }
  return shotToPose(shots[shots.length - 1]);
}

function focusPoint(focus: Shot["focus"]): Vec3 {
  return Array.isArray(focus) ? focus : ANCHOR[focus];
}

/* ---------------- the normalised body (selectable, draggable) ---------------- */
function Body({
  tf, selectRef, onSelect,
}: { tf: TF; selectRef: (o: THREE.Object3D | null) => void; onSelect: () => void }) {
  const { scene } = useGLTF(BODY_URL);
  const node = useMemo(() => {
    const s = scene.clone(true);
    const box = new THREE.Box3().setFromObject(s);
    const size = new THREE.Vector3(); const center = new THREE.Vector3();
    box.getSize(size); box.getCenter(center);
    const scale = BODY_FIT / size.y;
    s.scale.setScalar(scale);
    s.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    return s;
  }, [scene]);
  return (
    <group
      ref={selectRef} name="body" position={tf.position} rotation={tf.rotation} scale={tf.scale}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <primitive object={node} />
    </group>
  );
}

/* ---------------- the lens (selectable wrapper at its seated transform) ---------------- */
function Lens({ transmission, selectRef }: { transmission: number; selectRef: (o: THREE.Object3D | null) => void }) {
  const { scene } = useGLTF(LENS_URL);
  const { node, seat } = useMemo(() => {
    const s = scene.clone(true);
    s.rotation.set(0, Math.PI / 2, 0);
    const box = new THREE.Box3().setFromObject(s);
    const size = new THREE.Vector3(); box.getSize(size);
    const scale = LENS.diameter / Math.max(size.x, size.y);
    s.scale.setScalar(scale);
    const box2 = new THREE.Box3().setFromObject(s);
    const c2 = new THREE.Vector3(); box2.getCenter(c2);
    const seat: [number, number, number] = [
      ANCHOR.mount[0] - c2.x,
      ANCHOR.mount[1] - c2.y,
      ANCHOR.mount[2] - box2.min.z + LENS.seatZ,
    ];
    // bake position into a fresh group; keep node centred so the gizmo sits on it
    s.position.set(0, 0, 0);
    return { node: s, seat };
  }, [scene]);

  useMemo(() => {
    node.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined;
      if (m && "transmission" in m) { m.transmission = transmission; m.thickness = transmission > 0 ? 0.4 : 0; m.needsUpdate = true; }
    });
  }, [node, transmission]);

  return (
    <group ref={selectRef} name="lens" position={seat} onClick={(e) => { e.stopPropagation(); }}>
      <primitive object={node} />
    </group>
  );
}

/* ---------------- built parts ---------------- */
const M = {
  cap: new THREE.MeshStandardMaterial({ color: 0x070708, metalness: 0.35, roughness: 0.85 }),
  well: new THREE.MeshStandardMaterial({ color: 0x0c0c10, metalness: 0.5, roughness: 0.6 }),
  rim: new THREE.MeshStandardMaterial({ color: 0x0a1a1a, emissive: 0x21e0d6, emissiveIntensity: 1.1, metalness: 0.3, roughness: 0.4 }),
  sensor: new THREE.MeshStandardMaterial({ color: 0x8a2be2, emissive: 0x5a1f9a, emissiveIntensity: 0.45, metalness: 0.7, roughness: 0.16 }),
  slat: new THREE.MeshStandardMaterial({ color: 0x17171b, metalness: 0.55, roughness: 0.5 }),
  irisFrame: new THREE.MeshStandardMaterial({ color: 0x6a4a2a, metalness: 0.9, roughness: 0.3 }),
  irisBlade: new THREE.MeshStandardMaterial({ color: 0x52555e, metalness: 0.95, roughness: 0.22 }),
  glow: new THREE.MeshStandardMaterial({ color: 0x120a04, emissive: 0xf0883e, emissiveIntensity: 0.5, roughness: 1 }),
  zoomTargetFill: new THREE.MeshBasicMaterial({ color: 0xf0883e, transparent: true, opacity: 0.28, side: THREE.DoubleSide }),
  zoomTargetEdge: new THREE.LineBasicMaterial({ color: 0xf0883e }),
};
const ZOOM_TARGET_EDGES = new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1));

/* flat unit rectangle — drag/scale it onto the eyepiece, then export and
   paste into PLACEMENT.zoomTarget in cameraScript.ts. scale.x/scale.y are
   its width/height since the base geometry is 1×1. */
function ZoomTarget() {
  return (
    <group>
      <mesh material={M.zoomTargetFill}><planeGeometry args={[1, 1]} /></mesh>
      <lineSegments geometry={ZOOM_TARGET_EDGES} material={M.zoomTargetEdge} />
    </group>
  );
}

function CapCover() {
  return (
    <group>
      <mesh material={M.cap}><circleGeometry args={[0.54, 56]} /></mesh>
      <mesh material={M.well} position={[0, 0, 0.006]}><ringGeometry args={[0.38, 0.5, 48]} /></mesh>
    </group>
  );
}
function Sensor() {
  return (
    <group>
      <mesh material={M.rim}><planeGeometry args={[0.7, 0.47]} /></mesh>
      <mesh material={M.sensor} position={[0, 0, 0.003]}><planeGeometry args={[0.66, 0.44]} /></mesh>
    </group>
  );
}
function Shutter() {
  const slats = [0, 1, 2, 3];
  return (
    <group>
      {slats.map((i) => (
        <mesh key={`t${i}`} material={M.slat} position={[0, 0.026 + i * 0.052, i * 0.0006]}>
          <boxGeometry args={[0.64, 0.052, 0.004]} />
        </mesh>
      ))}
      {slats.map((i) => (
        <mesh key={`b${i}`} material={M.slat} position={[0, -0.026 - i * 0.052, i * 0.0006]}>
          <boxGeometry args={[0.64, 0.052, 0.004]} />
        </mesh>
      ))}
    </group>
  );
}
function Iris() {
  const N = 9;
  return (
    <group>
      <mesh material={M.glow} position={[0, 0, -0.06]}><circleGeometry args={[0.2, 40]} /></mesh>
      <mesh material={M.irisFrame}><ringGeometry args={[0.32, 0.36, 48]} /></mesh>
      {Array.from({ length: N }).map((_, i) => (
        <group key={i} rotation={[0, 0, (i / N) * Math.PI * 2]}>
          <mesh material={M.irisBlade} position={[0, 0.36, i * 0.0004]}>
            <boxGeometry args={[0.42, 0.52, 0.004]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const PARTS: { key: string; label: string; Comp: React.FC }[] = [
  { key: "capCover", label: "Cap cover", Comp: CapCover },
  { key: "sensor", label: "Sensor", Comp: Sensor },
  { key: "shutter", label: "Shutter", Comp: Shutter },
  { key: "iris", label: "Iris + glow", Comp: Iris },
  { key: "zoomTarget", label: "Zoom target", Comp: ZoomTarget },
];

/* ---------------- framing preview: drives the canvas camera along the
   (editable) shot list when active, instead of OrbitControls ---------------- */
function FlightRig({ shots, p, active }: { shots: Shot[]; p: number; active: boolean }) {
  const { camera } = useThree();
  useFrame(() => {
    if (!active) return;
    const { pos, target } = sampleShotsAt(shots, p);
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(target[0], target[1], target[2]);
  });
  return null;
}

/* keeps OrbitControls' pivot on the selected shot's focus point so orbiting
   composes a frame around the same point the shot aims at, and continuously
   reports the live camera pose outRef (for "capture from view") */
function FramingHelper({
  controlsRef, focus, active, outRef,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>; focus: Vec3; active: boolean;
  outRef: React.MutableRefObject<{ pos: Vec3; target: Vec3 }>;
}) {
  const { camera } = useThree();
  const [fx, fy, fz] = focus;
  useEffect(() => {
    if (active) return;
    const c = controlsRef.current;
    if (!c) return;
    c.target.set(fx, fy, fz);
    c.update();
  }, [controlsRef, fx, fy, fz, active]);
  useFrame(() => {
    const t = controlsRef.current?.target;
    outRef.current = {
      pos: [camera.position.x, camera.position.y, camera.position.z],
      target: t ? [t.x, t.y, t.z] : focus,
    };
  });
  return null;
}

type GizmoTarget = "pos" | "focus";

/* small marker + aim-line per shot. Click the orange (position) dot or the
   cyan (focus) cube to select that shot AND pick which point the gizmo
   below drags. */
function ShotMarkers({
  shots, selIdx, gizmoTarget, onSelectGizmoTarget,
}: {
  shots: Shot[]; selIdx: number; gizmoTarget: GizmoTarget;
  onSelectGizmoTarget: (i: number, t: GizmoTarget) => void;
}) {
  const poses = useMemo(() => shots.map(shotToPose), [shots]);
  return (
    <>
      <Line points={poses.map((p) => p.pos)} color="#556" lineWidth={1} dashed={false} />
      {poses.map((p, i) => {
        const posSel = i === selIdx && gizmoTarget === "pos";
        const focusSel = i === selIdx && gizmoTarget === "focus";
        return (
          <group key={i}>
            <Line points={[p.pos, p.target]} color={i === selIdx ? "#f0883e" : "#445"} lineWidth={1} />
            <mesh
              position={p.pos}
              onClick={(e) => { e.stopPropagation(); onSelectGizmoTarget(i, "pos"); }}
            >
              <sphereGeometry args={[posSel ? 0.055 : 0.032, 16, 16]} />
              <meshBasicMaterial color={posSel ? "#f0883e" : "#7a8"} />
            </mesh>
            <mesh
              position={p.target}
              onClick={(e) => { e.stopPropagation(); onSelectGizmoTarget(i, "focus"); }}
            >
              <boxGeometry args={focusSel ? [0.05, 0.05, 0.05] : [0.03, 0.03, 0.03]} />
              <meshBasicMaterial color={focusSel ? "#21e0d6" : "#3a8a86"} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

/* draggable proxy for whichever point (camera position or focus) is being
   edited on the selected shot — same translate-gizmo interaction as the
   Parts tab, just applied to a point instead of a mesh. Rotate/scale don't
   have a meaningful equivalent for a point, so this is translate-only; the
   "rotation" of the shot is implicit in the dir/dist recomputed from the
   dragged position. */
function ShotGizmo({ point, onChange }: { point: Vec3; onChange: (p: Vec3) => void }) {
  const ref = useRef<THREE.Object3D | null>(null);
  const [mounted, setMounted] = useState(false);
  return (
    <>
      <group
        ref={(o) => { ref.current = o; if (o && !mounted) setMounted(true); }}
        position={point}
      />
      {mounted && ref.current && (
        <TransformControls
          object={ref.current}
          mode="translate"
          size={0.7}
          onObjectChange={() => {
            const o = ref.current;
            if (!o) return;
            onChange([o.position.x, o.position.y, o.position.z]);
          }}
        />
      )}
    </>
  );
}

function Scene({
  tab, selKey, mode, transmission, refs, onSelect, onChange,
  shots, shotIdx, gizmoTarget, onSelectGizmoTarget, onShotGizmoChange,
  previewP, flightActive, controlsRef, camOutRef,
}: {
  tab: Tab; selKey: string | null; mode: Mode; transmission: number;
  refs: React.MutableRefObject<Record<string, THREE.Object3D | null>>;
  onSelect: (k: string) => void;
  onChange: () => void;
  shots: Shot[]; shotIdx: number; gizmoTarget: GizmoTarget;
  onSelectGizmoTarget: (i: number, t: GizmoTarget) => void;
  onShotGizmoChange: (t: GizmoTarget, p: Vec3) => void;
  previewP: number; flightActive: boolean;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  camOutRef: React.MutableRefObject<{ pos: Vec3; target: Vec3 }>;
}) {
  const saved = useMemo(loadSaved, []);
  const selObj = tab === "parts" && selKey ? refs.current[selKey] : null;

  return (
    <>
      <OrbitControls ref={controlsRef} makeDefault enabled={!flightActive} enableDamping dampingFactor={0.1} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 2]} intensity={2.0} />
      <directionalLight position={[-3, 2, -3]} intensity={1.4} color="#bcd2ff" />
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={3} position={[-2.5, 2, 3]} scale={[4, 4, 1]} color="#fff0dd" />
        <Lightformer form="rect" intensity={2} position={[3, 1, 2.5]} scale={[3, 4, 1]} color="#9bb8ff" />
      </Environment>
      <Grid args={[10, 10]} cellColor="#222" sectionColor="#333" position={[0, -0.9, 0]} infiniteGrid fadeDistance={18} />

      <Suspense fallback={null}>
        <Body tf={saved.body} selectRef={(o) => (refs.current.body = o)} onSelect={() => onSelect("body")} />
        <Lens transmission={transmission} selectRef={(o) => (refs.current.lens = o)} />
      </Suspense>

      {PARTS.map(({ key, Comp }) => {
        const t = saved[key];
        return (
          <group
            key={key}
            name={key}
            ref={(o) => (refs.current[key] = o)}
            position={t.position}
            rotation={t.rotation}
            scale={t.scale}
            onClick={(e) => { e.stopPropagation(); onSelect(key); }}
          >
            <Comp />
          </group>
        );
      })}

      {tab === "parts" && selObj && (
        <TransformControls object={selObj} mode={mode} onObjectChange={onChange} size={0.8} />
      )}

      {tab === "framing" && (
        <>
          <ShotMarkers shots={shots} selIdx={shotIdx} gizmoTarget={gizmoTarget} onSelectGizmoTarget={onSelectGizmoTarget} />
          {!flightActive && (
            <ShotGizmo
              key={`${shotIdx}-${gizmoTarget}`}
              point={gizmoTarget === "pos" ? shotToPose(shots[shotIdx]).pos : focusPoint(shots[shotIdx].focus)}
              onChange={(p) => onShotGizmoChange(gizmoTarget, p)}
            />
          )}
          <FlightRig shots={shots} p={previewP} active={flightActive} />
          <FramingHelper
            controlsRef={controlsRef} focus={focusPoint(shots[shotIdx].focus)} active={flightActive} outRef={camOutRef}
          />
        </>
      )}
    </>
  );
}

export default function AssetLab() {
  const refs = useRef<Record<string, THREE.Object3D | null>>({});
  const [tab, setTab] = useState<Tab>("parts");
  const [selKey, setSelKey] = useState<string | null>("iris");
  const [mode, setMode] = useState<Mode>("translate");
  const [transmission, setTransmission] = useState(0);
  /* bumped only by gizmo drags, so the number inputs remount (and refresh)
     without losing focus/cursor position while the user is typing into them */
  const [gizmoTick, bumpGizmo] = useState(0);

  const [shots, setShots] = useState<Shot[]>(loadSavedShots);
  const [shotIdx, setShotIdx] = useState(0);
  const [gizmoTarget, setGizmoTarget] = useState<GizmoTarget>("pos");
  const [previewP, setPreviewP] = useState(SHOTS[0].p);
  const [flightActive, setFlightActive] = useState(false);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const camOutRef = useRef<{ pos: Vec3; target: Vec3 }>({ pos: [0, 0, 0], target: [0, 0, 0] });

  /* this sandbox has no custom cursor follower — show the native one */
  useEffect(() => {
    document.body.style.cursor = "auto";
    return () => { document.body.style.cursor = ""; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(SHOTS_LS_KEY, JSON.stringify(shots)); } catch { /* ignore */ }
  }, [shots]);

  const persist = () => {
    const out: Record<string, TF> = {};
    for (const k of Object.keys(refs.current)) {
      const o = refs.current[k];
      if (!o) continue;
      out[k] = {
        position: [+o.position.x.toFixed(3), +o.position.y.toFixed(3), +o.position.z.toFixed(3)],
        rotation: [+o.rotation.x.toFixed(3), +o.rotation.y.toFixed(3), +o.rotation.z.toFixed(3)],
        scale: [+o.scale.x.toFixed(3), +o.scale.y.toFixed(3), +o.scale.z.toFixed(3)],
      };
    }
    try { localStorage.setItem(LS_KEY, JSON.stringify(out)); } catch { /* ignore */ }
    return out;
  };

  const onChange = () => { persist(); bumpGizmo((n) => n + 1); };

  // keyboard shortcuts: g/r/s
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT") return;
      if (e.key === "g") setMode("translate");
      if (e.key === "r") setMode("rotate");
      if (e.key === "s") setMode("scale");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const sel = selKey ? refs.current[selKey] : null;
  const fmt = (v: number) => Math.round(v * 1000) / 1000;

  const setNum = (which: "position" | "rotation" | "scale", axis: "x" | "y" | "z", raw: string) => {
    const v = parseFloat(raw);
    if (Number.isNaN(v) || !sel) return;
    sel[which][axis] = v;
    persist(); // no bumpGizmo here — keep the inputs mounted so typing isn't interrupted
  };

  const exportParts = () => {
    const out = persist();
    const json = JSON.stringify(out, null, 2);
    // eslint-disable-next-line no-console
    console.log("[assetlab] transforms\n" + json);
    navigator.clipboard?.writeText(json).catch(() => {});
  };
  const resetParts = () => { localStorage.removeItem(LS_KEY); window.location.reload(); };

  const shot = shots[shotIdx];
  const updateShot = (patch: Partial<Shot>) => {
    setShots((prev) => prev.map((s, i) => (i === shotIdx ? { ...s, ...patch } : s)));
  };
  const selectShot = (i: number) => { setShotIdx(i); setPreviewP(shots[i].p); };
  /* clicking a marker in the canvas selects its shot AND which point the
     gizmo drags; an anchor-based focus is converted to a free xyz point the
     first time it's grabbed, the same conversion the "custom xyz" dropdown
     option already does. */
  const selectGizmoTarget = (i: number, t: GizmoTarget) => {
    selectShot(i);
    if (t === "focus" && !Array.isArray(shots[i].focus)) {
      const f = focusPoint(shots[i].focus);
      setShots((prev) => prev.map((s, idx) => (idx === i ? { ...s, focus: [...f] as Vec3 } : s)));
    }
    setGizmoTarget(t);
  };
  /* dragging the position dot keeps focus fixed and recomputes dir/dist;
     dragging the focus cube just moves the focus point directly. */
  const onShotGizmoChange = (t: GizmoTarget, p: Vec3) => {
    if (t === "focus") {
      updateShot({ focus: p });
      return;
    }
    const f = focusPoint(shot.focus);
    const dx = p[0] - f[0], dy = p[1] - f[1], dz = p[2] - f[2];
    const dist = Math.hypot(dx, dy, dz) || 0.01;
    updateShot({ dir: [dx / dist, dy / dist, dz / dist], dist: +dist.toFixed(3) });
  };
  /* insert a stop after the selected one (or, if it's the last stop, before
     it) — cloning its framing so the new stop starts as a no-op midpoint. */
  const addStop = () => {
    const cur = shots[shotIdx];
    const isLast = shotIdx === shots.length - 1;
    const insertAt = isLast ? shotIdx : shotIdx + 1;
    const neighbour = isLast ? shots[shotIdx - 1] : shots[shotIdx + 1];
    const newP = neighbour
      ? +(((cur.p + neighbour.p) / 2).toFixed(3))
      : +Math.min(1, cur.p + 0.05).toFixed(3);
    const inserted: Shot = {
      p: newP,
      focus: Array.isArray(cur.focus) ? ([...cur.focus] as Vec3) : cur.focus,
      dir: [...cur.dir] as Vec3,
      dist: cur.dist,
    };
    const arr = [...shots];
    arr.splice(insertAt, 0, inserted);
    setShots(arr);
    setShotIdx(insertAt);
  };
  const removeStop = () => {
    if (shots.length <= 2) return; // a flight needs at least two stops
    const arr = shots.filter((_, i) => i !== shotIdx);
    setShots(arr);
    setShotIdx((i) => Math.min(i, arr.length - 1));
  };
  const setShotNum = (field: "p" | "dist", raw: string) => {
    const v = parseFloat(raw);
    if (Number.isNaN(v)) return;
    updateShot({ [field]: v } as Partial<Shot>);
  };
  const setShotDir = (axis: 0 | 1 | 2, raw: string) => {
    const v = parseFloat(raw);
    if (Number.isNaN(v)) return;
    const dir = [...shot.dir] as Vec3; dir[axis] = v;
    updateShot({ dir });
  };
  const setShotFocusAnchor = (key: string) => {
    if (key === "custom") updateShot({ focus: [...focusPoint(shot.focus)] as Vec3 });
    else updateShot({ focus: key as keyof typeof ANCHOR });
  };
  const setShotFocusXYZ = (axis: 0 | 1 | 2, raw: string) => {
    const v = parseFloat(raw);
    if (Number.isNaN(v) || !Array.isArray(shot.focus)) return;
    const f = [...shot.focus] as Vec3; f[axis] = v;
    updateShot({ focus: f });
  };
  const captureFromView = () => {
    const f = focusPoint(shot.focus);
    const [cx, cy, cz] = camOutRef.current.pos;
    const dx = cx - f[0], dy = cy - f[1], dz = cz - f[2];
    const dist = Math.hypot(dx, dy, dz) || 0.01;
    updateShot({ dir: [dx / dist, dy / dist, dz / dist], dist: +dist.toFixed(3) });
  };
  const exportShots = () => {
    const json = JSON.stringify(shots, null, 2);
    // eslint-disable-next-line no-console
    console.log("[assetlab] shots\n" + json);
    navigator.clipboard?.writeText(json).catch(() => {});
  };
  const resetShots = () => { localStorage.removeItem(SHOTS_LS_KEY); window.location.reload(); };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0b0b0d" }}>
      <Canvas dpr={[1, 2]} camera={{ fov: 40, position: [2.4, 1.4, 3.4], near: 0.01, far: 100 }}>
        <Scene
          tab={tab} selKey={selKey} mode={mode} transmission={transmission} refs={refs} onSelect={setSelKey} onChange={onChange}
          shots={shots} shotIdx={shotIdx} gizmoTarget={gizmoTarget} onSelectGizmoTarget={selectGizmoTarget}
          onShotGizmoChange={onShotGizmoChange} previewP={previewP} flightActive={flightActive}
          controlsRef={controlsRef} camOutRef={camOutRef}
        />
      </Canvas>

      {/* control panel */}
      <div style={panel}>
        <div style={{ fontWeight: 700, marginBottom: 8, letterSpacing: ".05em" }}>ASSET LAB</div>

        <div style={{ marginBottom: 10 }}>
          {(["parts", "framing"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={btn(tab === t)}>
              {t === "parts" ? "Parts" : "Framing"}
            </button>
          ))}
        </div>

        {tab === "parts" ? (
          <>
            <div style={{ opacity: 0.7, fontSize: 11, marginBottom: 10 }}>
              orbit: drag · zoom: scroll · select: click part or button · gizmo keys: g/r/s
            </div>

            <div style={{ marginBottom: 8 }}>
              <button onClick={() => setSelKey("body")} style={btn(selKey === "body")}>Body</button>
              {PARTS.map((p) => (
                <button key={p.key} onClick={() => setSelKey(p.key)} style={btn(selKey === p.key)}>{p.label}</button>
              ))}
              <button onClick={() => setSelKey("lens")} style={btn(selKey === "lens")}>Lens</button>
            </div>

            <div style={{ marginBottom: 8 }}>
              {(["translate", "rotate", "scale"] as Mode[]).map((m) => (
                <button key={m} onClick={() => setMode(m)} style={btn(mode === m)}>{m}</button>
              ))}
            </div>

            <div style={{ marginBottom: 10, fontSize: 11 }}>
              <label>lens glass: {transmission.toFixed(2)}</label>
              <input type="range" min={0} max={1} step={0.05} value={transmission}
                onChange={(e) => setTransmission(parseFloat(e.target.value))} style={{ width: "100%" }} />
            </div>

            <div style={{ fontFamily: "monospace", fontSize: 11, marginBottom: 10, minHeight: 54 }}>
              {sel ? (
                <div key={`${selKey}-${gizmoTick}`}>
                  <div style={{ color: "#f0883e", marginBottom: 4 }}>{selKey}</div>
                  {(["position", "rotation", "scale"] as const).map((which) => (
                    <div key={which} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                      <span style={{ width: 26, opacity: 0.6 }}>{which === "position" ? "pos" : which === "rotation" ? "rot" : "scl"}</span>
                      {(["x", "y", "z"] as const).map((axis) => (
                        <input
                          key={axis}
                          type="number"
                          step={which === "rotation" ? 0.01 : 0.001}
                          defaultValue={fmt(sel[which][axis])}
                          onChange={(e) => setNum(which, axis, e.target.value)}
                          style={numInput}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              ) : <div style={{ opacity: 0.6 }}>nothing selected</div>}
            </div>

            <div>
              <button onClick={exportParts} style={btn(false)}>Export → clipboard</button>
              <button onClick={resetParts} style={btn(false)}>Reset</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ opacity: 0.7, fontSize: 11, marginBottom: 10 }}>
              orbits around the selected shot's focus · click the orange dot (position) or
              cyan cube (focus) to select and grab it, or drag the gizmo like in Parts ·
              scrub previews the real flight · capture bakes your framing into the shot
            </div>

            <div style={{ marginBottom: 8 }}>
              {shots.map((s, i) => (
                <button key={i} onClick={() => selectShot(i)} style={btn(shotIdx === i)}>
                  {i + 1} · {s.p.toFixed(2)}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 8 }}>
              <button onClick={addStop} style={btn(false)}>+ Add stop</button>
              <button onClick={removeStop} style={btn(false)} disabled={shots.length <= 2}>Delete stop</button>
            </div>

            <div style={{ marginBottom: 8, fontSize: 11 }}>
              <span style={{ opacity: 0.6, marginRight: 4 }}>drag:</span>
              <button onClick={() => selectGizmoTarget(shotIdx, "pos")} style={btn(gizmoTarget === "pos")}>Position</button>
              <button onClick={() => selectGizmoTarget(shotIdx, "focus")} style={btn(gizmoTarget === "focus")}>Focus</button>
            </div>

            <div style={{ marginBottom: 10, fontSize: 11 }}>
              <label>preview p: {previewP.toFixed(3)}</label>
              <input
                type="range" min={0} max={1} step={0.001} value={previewP}
                onChange={(e) => { setPreviewP(parseFloat(e.target.value)); setFlightActive(true); }}
                style={{ width: "100%" }}
              />
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button onClick={() => setFlightActive((v) => !v)} style={btn(flightActive)}>
                  {flightActive ? "Previewing…" : "Preview flight"}
                </button>
                <button onClick={() => { setPreviewP(shot.p); setFlightActive(true); }} style={btn(false)}>Jump to shot</button>
              </div>
            </div>

            <div style={{ fontFamily: "monospace", fontSize: 11, marginBottom: 10 }}>
              <div style={{ color: "#f0883e", marginBottom: 4 }}>shot {shotIdx + 1}</div>

              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                <span style={{ width: 32, opacity: 0.6 }}>p</span>
                <input type="number" step={0.001} defaultValue={fmt(shot.p)} onChange={(e) => setShotNum("p", e.target.value)} style={numInput} />
                <span style={{ width: 32, opacity: 0.6, marginLeft: 8 }}>dist</span>
                <input type="number" step={0.01} defaultValue={fmt(shot.dist)} onChange={(e) => setShotNum("dist", e.target.value)} style={numInput} />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                <span style={{ width: 32, opacity: 0.6 }}>dir</span>
                {(["x", "y", "z"] as const).map((axis, i) => (
                  <input
                    key={axis} type="number" step={0.01} defaultValue={fmt(shot.dir[i])}
                    onChange={(e) => setShotDir(i as 0 | 1 | 2, e.target.value)} style={numInput}
                  />
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                <span style={{ width: 32, opacity: 0.6 }}>focus</span>
                <select
                  value={Array.isArray(shot.focus) ? "custom" : shot.focus}
                  onChange={(e) => setShotFocusAnchor(e.target.value)}
                  style={{ ...numInput, width: 110 }}
                >
                  {Object.keys(ANCHOR).map((k) => <option key={k} value={k}>{k}</option>)}
                  <option value="custom">custom xyz</option>
                </select>
              </div>
              {Array.isArray(shot.focus) && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                  <span style={{ width: 32, opacity: 0.6 }} />
                  {(["x", "y", "z"] as const).map((axis, i) => (
                    <input
                      key={axis} type="number" step={0.001} defaultValue={fmt((shot.focus as Vec3)[i])}
                      onChange={(e) => setShotFocusXYZ(i as 0 | 1 | 2, e.target.value)} style={numInput}
                    />
                  ))}
                </div>
              )}

              <button onClick={captureFromView} style={{ ...btn(false), marginTop: 4 }} disabled={flightActive}>
                Capture from current view
              </button>
            </div>

            <div>
              <button onClick={exportShots} style={btn(false)}>Export → clipboard</button>
              <button onClick={resetShots} style={btn(false)}>Reset</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const panel: React.CSSProperties = {
  position: "fixed", top: 14, left: 14, width: 280, padding: 14,
  background: "rgba(12,12,16,0.86)", border: "1px solid #2a2a30", borderRadius: 10,
  color: "#eee", font: "13px/1.4 -apple-system, system-ui, sans-serif", backdropFilter: "blur(8px)",
  maxHeight: "calc(100vh - 28px)", overflowY: "auto",
};
function btn(active: boolean): React.CSSProperties {
  return {
    margin: "0 6px 6px 0", padding: "5px 9px", fontSize: 11, cursor: "pointer",
    background: active ? "#f0883e" : "#1c1c22", color: active ? "#111" : "#ddd",
    border: "1px solid #333", borderRadius: 6,
  };
}
const numInput: React.CSSProperties = {
  width: 58, padding: "3px 5px", fontSize: 11, fontFamily: "monospace",
  background: "#1c1c22", color: "#ddd", border: "1px solid #333", borderRadius: 4,
};
