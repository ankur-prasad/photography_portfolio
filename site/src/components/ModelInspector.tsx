import { Suspense, useMemo, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, Environment, Grid, Html } from "@react-three/drei";
import * as THREE from "three";

function Model({ url, label }: { url: string; label: string }) {
  const { scene } = useGLTF(url);
  const { node, info } = useMemo(() => {
    const s = scene.clone(true);
    const box = new THREE.Box3().setFromObject(s);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const scale = 2 / Math.max(size.x, size.y, size.z);
    s.scale.setScalar(scale);
    s.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    const info = `${label}\nsize x:${size.x.toFixed(2)} y:${size.y.toFixed(2)} z:${size.z.toFixed(2)}\ncenter ${center.x.toFixed(2)},${center.y.toFixed(2)},${center.z.toFixed(2)}`;
    return { node: s, info };
  }, [scene, label]);
  return (
    <group>
      <primitive object={node} />
      <Html position={[0, 1.4, 0]} center>
        <pre style={{ color: "#0f0", fontSize: 11, background: "#000a", padding: 6, whiteSpace: "pre" }}>{info}</pre>
      </Html>
    </group>
  );
}

function Axes() {
  // red=+X, green=+Y, blue=+Z
  return <primitive object={new THREE.AxesHelper(2)} />;
}

export default function ModelInspector() {
  useEffect(() => {
    document.body.style.cursor = "auto";
    return () => { document.body.style.cursor = ""; };
  }, []);

  const url = new URLSearchParams(window.location.search).get("m") === "lens"
    ? "/models/camera_lens.glb"
    : "/models/camera_body.glb";
  const label = url.includes("lens") ? "LENS" : "BODY";
  const view = new URLSearchParams(window.location.search).get("v") || "front";
  const pos: Record<string, [number, number, number]> = {
    front: [0, 0, 4],
    back: [0, 0, -4],
    left: [-4, 0, 0],
    right: [4, 0, 0],
    top: [0, 4, 0.001],
    iso: [3, 2, 3],
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "#111" }}>
      <Canvas camera={{ position: pos[view] || pos.front, fov: 40 }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 4, 2]} intensity={1.5} />
          <Environment preset="studio" />
          <Axes />
          <Grid args={[10, 10]} cellColor="#333" sectionColor="#555" position={[0, -1, 0]} />
          <Model url={url} label={label} />
        </Suspense>
      </Canvas>
      <div style={{ position: "fixed", top: 8, left: 8, color: "#fff", fontFamily: "monospace", fontSize: 12 }}>
        {label} · view={view} · axes: R=+X G=+Y B=+Z<br />
        ?m=body|lens &v=front|back|left|right|top|iso
      </div>
    </div>
  );
}
