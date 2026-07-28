/* ============================================================================
   Scene3DShell — the shared <Canvas> setup for the two new scenes.

   Centralises the conventions the home act arrived at by trial (dpr clamp,
   inner Suspense, powerPreference, __r3f under ?debug) plus the ones the new
   scenes need on top: opaque buffers, no stencil, adaptive dpr under load, and
   a hook to feed renderer capabilities into the texture cache.
   ========================================================================== */

import { Suspense, type ReactNode } from "react";
import { Canvas, type RootState } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents, PerformanceMonitor } from "@react-three/drei";
import { dprMax, photoVramBudget } from "./budgets";
import { setAnisotropy, setBudget } from "./photoTextureCache";

declare global {
  interface Window {
    __r3f?: RootState;
  }
}

export interface Scene3DShellProps {
  children: ReactNode;
  scene: "gallery" | "room";
  camera?: { fov?: number; near?: number; far?: number; position?: [number, number, number] };
  className?: string;
  /** "demand" for the static configurator, "always" for the scroll walk */
  frameloop?: "always" | "demand" | "never";
  debug?: boolean;
  onCreated?: (state: RootState) => void;
}

export default function Scene3DShell({
  children,
  scene,
  camera,
  className,
  frameloop = "always",
  debug = false,
  onCreated,
}: Scene3DShellProps) {
  return (
    <Canvas
      className={className}
      frameloop={frameloop}
      dpr={[1, dprMax()]}
      /* Both scenes are opaque interiors — unlike the home act, nothing needs to
         show through the canvas, and dropping alpha + stencil saves bandwidth on
         every frame. */
      gl={{ antialias: true, alpha: false, stencil: false, powerPreference: "high-performance" }}
      camera={{
        fov: camera?.fov ?? 46,
        near: camera?.near ?? 0.05,
        far: camera?.far ?? 60,
        position: camera?.position ?? [0, 1.6, 0],
      }}
      onCreated={(state) => {
        setBudget(photoVramBudget(scene));
        setAnisotropy(state.gl.capabilities.getMaxAnisotropy());
        if (debug) window.__r3f = state;
        onCreated?.(state);
      }}
    >
      {/* Step dpr down rather than dropping frames on weaker GPUs. */}
      <PerformanceMonitor factor={1} />
      <AdaptiveDpr pixelated={false} />
      <AdaptiveEvents />
      <Suspense fallback={null}>{children}</Suspense>
    </Canvas>
  );
}
