import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

export interface DepthPointer {
  x: number;
  y: number;
  zoom: number;
  strength: number;
}

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTex;
  uniform sampler2D uDepth;
  uniform vec2 uMouse;
  uniform float uStrength;
  uniform float uZoom;
  uniform float uTime;

  void main() {
    vec2 uv = (vUv - 0.5) / uZoom + 0.5;
    // gentle idle drift so the photo breathes even without a cursor
    vec2 drift = vec2(sin(uTime * 0.32), cos(uTime * 0.21)) * 0.18;
    vec2 m = uMouse + drift;
    float d = texture2D(uDepth, uv).r;
    vec2 off = m * uStrength * (d - 0.42);
    vec2 suv = clamp(uv + off, 0.002, 0.998);
    vec4 c = texture2D(uTex, suv);
    // subtle depth-aware vignette to seat the frame
    float vig = smoothstep(1.25, 0.45, length(vUv - 0.5) * 1.6);
    gl_FragColor = vec4(c.rgb * mix(0.92, 1.0, vig), 1.0);
  }
`;

function DepthPlane({
  photo,
  depth,
  pointer,
}: {
  photo: string;
  depth: string;
  pointer: React.MutableRefObject<DepthPointer>;
}) {
  const [tex, dep] = useTexture([photo, depth]);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  dep.minFilter = THREE.LinearFilter;

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTex: { value: tex },
          uDepth: { value: dep },
          uMouse: { value: new THREE.Vector2(0, 0) },
          uStrength: { value: 0.045 },
          uZoom: { value: 1 },
          uTime: { value: 0 },
        },
      }),
    [tex, dep]
  );

  const { viewport } = useThree();
  const img = tex.image as HTMLImageElement;
  const imgAspect = img.width / img.height;
  const viewAspect = viewport.width / viewport.height;
  const scale: [number, number, number] =
    viewAspect > imgAspect
      ? [viewport.width, viewport.width / imgAspect, 1]
      : [viewport.height * imgAspect, viewport.height, 1];

  useFrame((_, dt) => {
    const u = material.uniforms;
    const p = pointer.current;
    u.uTime.value += dt;
    const k = Math.min(1, dt * 4.2); // smooth chase
    (u.uMouse.value as THREE.Vector2).x += (p.x - u.uMouse.value.x) * k;
    (u.uMouse.value as THREE.Vector2).y += (p.y - u.uMouse.value.y) * k;
    u.uZoom.value += (p.zoom - u.uZoom.value) * Math.min(1, dt * 2.4);
    u.uStrength.value += (p.strength - u.uStrength.value) * Math.min(1, dt * 2.4);
  });

  return (
    <mesh scale={scale}>
      <planeGeometry args={[1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/**
 * A photograph rendered as a living 2.5D scene.
 * Pointer movement (or idle drift) shifts perspective using an AI depth map.
 */
export default function DepthScene({
  photo,
  depth,
  strength = 0.045,
  zoom = 1,
  className,
  interactive = true,
}: {
  photo: string;
  depth: string;
  strength?: number;
  zoom?: number;
  className?: string;
  interactive?: boolean;
}) {
  const pointer = useRef<DepthPointer>({ x: 0, y: 0, zoom, strength });
  pointer.current.zoom = zoom;
  pointer.current.strength = strength;

  return (
    <div
      className={className}
      style={{ position: "absolute", inset: 0 }}
      onPointerMove={(e) => {
        if (!interactive) return;
        const r = e.currentTarget.getBoundingClientRect();
        pointer.current.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
        pointer.current.y = -((e.clientY - r.top) / r.height - 0.5) * 2;
      }}
      onPointerLeave={() => {
        pointer.current.x = 0;
        pointer.current.y = 0;
      }}
    >
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: false, powerPreference: "high-performance" }}
        camera={{ position: [0, 0, 5], fov: 45 }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Suspense fallback={null}>
          <DepthPlane photo={photo} depth={depth} pointer={pointer} />
        </Suspense>
      </Canvas>
    </div>
  );
}
