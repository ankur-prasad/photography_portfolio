/* ============================================================================
   ProjectedAnchor — publish a 3D point's screen position as CSS variables.

   This is how the /prints panels sit "in" the room while staying real DOM: the
   print's world position is projected every frame and written to custom
   properties, and the panel positions itself against them. So the copy is
   selectable, screen-reader legible and indexable, but it tracks the print as
   the camera walks past it.

   Generalised from the technique CameraModel already uses to grow the DOM
   favourites overlay out of the 3D LCD (--lcd-3d-*).

   Writes, for prefix "print":
     --print-x, --print-y     projected centre, px, clamped into the viewport
     --print-w                projected half-width of the subject, px
     --print-on               1 when the point is in front of the camera, else 0
   ========================================================================== */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3 } from "../../data/sceneScript";

export interface ProjectedAnchorProps {
  /** world point to track */
  centre: Vec3;
  /** a second point used only to measure on-screen size (e.g. centre + right·½w) */
  edge?: Vec3;
  prefix?: string;
  /** keep the anchor this many px inside the viewport, so a panel bound to it
   *  can never be pushed off screen when the camera moves in close */
  margin?: number;
}

export default function ProjectedAnchor({
  centre,
  edge,
  prefix = "print",
  margin = 24,
}: ProjectedAnchorProps) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const vCentre = useMemo(() => new THREE.Vector3(...centre), [centre]);
  const vEdge = useMemo(() => new THREE.Vector3(...(edge ?? centre)), [edge, centre]);
  const last = useRef({ x: -1, y: -1, w: -1, on: -1 });

  useFrame(() => {
    const root = document.documentElement;

    const c = vCentre.clone().project(camera);
    // z outside [-1,1] means behind the camera or past the far plane.
    const on = c.z >= -1 && c.z <= 1 ? 1 : 0;

    const halfW = size.width / 2;
    const halfH = size.height / 2;
    let x = c.x * halfW + halfW;
    let y = -c.y * halfH + halfH;

    const e = vEdge.clone().project(camera);
    const ex = e.x * halfW + halfW;
    const w = Math.abs(ex - x);

    x = Math.min(size.width - margin, Math.max(margin, x));
    y = Math.min(size.height - margin, Math.max(margin, y));

    // Only touch the DOM when something actually moved — this runs every frame.
    const l = last.current;
    if (Math.abs(x - l.x) > 0.5 || Math.abs(y - l.y) > 0.5 || Math.abs(w - l.w) > 0.5 || on !== l.on) {
      root.style.setProperty(`--${prefix}-x`, `${x.toFixed(1)}px`);
      root.style.setProperty(`--${prefix}-y`, `${y.toFixed(1)}px`);
      root.style.setProperty(`--${prefix}-w`, `${w.toFixed(1)}px`);
      root.style.setProperty(`--${prefix}-on`, `${on}`);
      last.current = { x, y, w, on };
    }
  });

  // Leave the vars in a sane state if the scene unmounts mid-walk.
  useEffect(() => {
    const root = document.documentElement;
    return () => {
      for (const k of ["x", "y", "w", "on"]) root.style.removeProperty(`--${prefix}-${k}`);
    };
  }, [prefix]);

  return null;
}
