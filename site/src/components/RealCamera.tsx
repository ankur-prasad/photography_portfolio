import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";

const URL = "/sony_a7m4_with_gm1635_f2.8.glb";
useGLTF.preload(URL);

function smoothstep(a: number, b: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/* ---------- region annotations (camera ↔ eye) ---------- */
interface Anno {
  no: string;
  name: string;
  eye: string;
  beat: number;
  side: "left" | "right";
  pos: [number, number, number]; // anchor in centred/scaled model space
}
// Only the genuinely-visible external features get a 3D leader line; the rest
// of the eye-mapping is carried by the narration column. Anchors are in the
// centred/scaled model space (lens protrudes toward -Z).
const ANNOS: Anno[] = [
  { no: "01", name: "Lens", eye: "Cornea + lens", beat: 1, side: "right", pos: [-0.1, 0.05, -0.85] },
  { no: "04", name: "Sensor", eye: "Retina", beat: 4, side: "left", pos: [-0.05, 0.0, -0.12] },
  { no: "06", name: "Viewfinder", eye: "Fovea", beat: 6, side: "right", pos: [0.05, 0.5, 0.05] },
];

function AnnoLabel({ a, show, occludeRef }: { a: Anno; show: boolean; occludeRef: React.RefObject<THREE.Object3D | null> }) {
  return (
    <Html
      position={a.pos}
      center={false}
      zIndexRange={[20, 0]}
      pointerEvents="none"
      occlude={occludeRef.current ? [occludeRef as React.RefObject<THREE.Object3D>] : undefined}
    >
      <div
        className={`cam-label ${a.side}`}
        style={{
          opacity: show ? 1 : 0,
          transition: "opacity 0.5s ease",
          flexDirection: a.side === "left" ? "row-reverse" : "row",
        }}
      >
        <span className="line" />
        <span className="txt">
          <b>{a.no}</b>
          {a.name} <em>→ {a.eye}</em>
        </span>
      </div>
    </Html>
  );
}

/* ---------- camera spin (degrees of turn across the breakdown) ---------- */
const ROT: { p: number; y: number }[] = [
  { p: 0.0, y: -2.4 },   // lens toward the viewer (front ¾) through the reveal + lens beat
  { p: 0.34, y: -2.1 },
  { p: 0.5, y: -1.2 },   // rotating to the side
  { p: 0.64, y: 0.2 },   // toward the back for sensor / processor beats
  { p: 0.78, y: 0.9 },   // back + EVF for the viewfinder beat
  { p: 0.92, y: 0.6 },
  { p: 1.0, y: -1.0 },   // settle on a clean ¾
];
function sampleRot(p: number) {
  if (p <= ROT[0].p) return ROT[0].y;
  if (p >= ROT[ROT.length - 1].p) return ROT[ROT.length - 1].y;
  for (let i = 0; i < ROT.length - 1; i++) {
    const a = ROT[i], b = ROT[i + 1];
    if (p >= a.p && p <= b.p) {
      const t = (p - a.p) / (b.p - a.p);
      return lerp(a.y, b.y, t * t * (3 - 2 * t));
    }
  }
  return ROT[ROT.length - 1].y;
}

export interface RealCameraProps {
  progress: React.MutableRefObject<number>;
  beat: number;
}

export default function RealCamera({ progress, beat }: RealCameraProps) {
  const { scene } = useGLTF(URL);
  const spin = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group>(null);
  const cur = useRef(0);

  const { model, materials } = useMemo(() => {
    const s = scene.clone(true);
    const box = new THREE.Box3().setFromObject(s);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const scale = 1.7 / Math.max(size.x, size.y, size.z);
    s.scale.setScalar(scale);
    s.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    const mats = new Set<THREE.Material>();
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material) {
        const arr = Array.isArray(m.material) ? m.material : [m.material];
        arr.forEach((mat) => {
          mat.transparent = true;
          mats.add(mat);
        });
      }
    });
    return { model: s, materials: Array.from(mats) };
  }, [scene]);

  useFrame((_, dt) => {
    cur.current += (progress.current - cur.current) * Math.min(1, dt * 6);
    const p = cur.current;
    if (spin.current) spin.current.rotation.y = sampleRot(p);
    const handoff = 1 - smoothstep(0.95, 1, p);
    const appear = smoothstep(0.04, 0.16, p);
    for (const m of materials) m.opacity = appear * handoff;
  });

  const showLabel = (b: number) => beat === b;

  return (
    <group ref={spin}>
      <group ref={modelRef}>
        <primitive object={model} />
      </group>
      {ANNOS.map((a) => (
        <AnnoLabel key={a.no} a={a} show={showLabel(a.beat)} occludeRef={modelRef} />
      ))}
    </group>
  );
}
