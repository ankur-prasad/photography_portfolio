/* ============================================================================
   Invalidate — request a frame when something outside the render loop changes.

   Needed by any scene using frameloop="demand". R3F only produces a frame when
   something asks for one, and a demand-mode Canvas whose nothing ever asks will
   never even run gl.setSize — the canvas stays at its 300×150 default and the
   scene appears blank with no error anywhere.

   Mount this inside the Canvas with the props the scene depends on. Components
   that animate (FlightRig easing, PhotoFrame waiting on a texture) keep the
   loop alive themselves by invalidating from inside useFrame until they settle,
   so the scene runs at full rate while anything is moving and drops to zero
   cost the moment it is still.
   ========================================================================== */

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

export default function Invalidate({ on }: { on: unknown[] }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    // Two frames: one to apply the change, one after any layout/resize settles.
    invalidate();
    const id = requestAnimationFrame(() => invalidate());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidate, ...on]);
  return null;
}
