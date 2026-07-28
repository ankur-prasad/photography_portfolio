/* ============================================================================
   FlightRig — drive the viewing camera along a scene's Shot list.

   Generalised from the home act's CameraRig. Differences that matter:
     - anchors + shots are props, so all three scenes share one rig
     - Shot.fov is interpolated (a living room needs a wider lens than a
       product shot of a camera body)
     - optional pointer parallax for scenes that are not scroll-driven, so the
       /prints configurator can feel alive without OrbitControls letting the
       customer lose the print
   ========================================================================== */

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  type Anchors,
  type Shot,
  type Vec3,
  damp,
  samplePoseIn,
} from "../../data/sceneScript";

export interface FlightRigProps {
  /** 0..1 along the shot list */
  progressRef: { current: number };
  anchors: Anchors;
  shots: Shot[];
  /** how fast the camera converges on the sampled pose (e-foldings/second) */
  ease?: number;
  /** ±degrees of pointer-driven yaw/pitch around the sampled pose */
  parallax?: { yaw: number; pitch: number };
  /** widen the framing on narrow viewports so the subject still fits */
  aspectFit?: boolean;
  /** called once the rig has produced a valid first frame */
  onReady?: () => void;
}

export default function FlightRig({
  progressRef,
  anchors,
  shots,
  ease = 7.5,
  parallax,
  aspectFit = true,
  onReady,
}: FlightRigProps) {
  const { camera, size, invalidate } = useThree();

  const pos = useRef(new THREE.Vector3());
  const target = useRef(new THREE.Vector3());
  const fov = useRef((camera as THREE.PerspectiveCamera).fov);
  const seeded = useRef(false);
  const ready = useRef(false);
  const pointer = useRef({ x: 0, y: 0 });

  /* Pointer parallax is read from a ref, never state — a mouse move must not
     re-render the scene. */
  useEffect(() => {
    if (!parallax) return;
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
      invalidate(); // frameloop="demand" scenes need waking
    };
    const onLeave = () => {
      pointer.current.x = 0;
      pointer.current.y = 0;
      invalidate();
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, [parallax, invalidate]);

  useFrame((_, dt) => {
    const p = progressRef.current;
    const pose = samplePoseIn(anchors, shots, p);

    const want = new THREE.Vector3(...(pose.pos as Vec3));
    const look = new THREE.Vector3(...(pose.target as Vec3));

    /* Portrait and narrow windows see a taller, narrower slice of the same
       framing, so pull back along the view direction to keep the subject in
       frame. The home rig does this too. */
    if (aspectFit) {
      const aspect = size.width / Math.max(1, size.height);
      if (aspect < 1.5) {
        const back = THREE.MathUtils.clamp(1.5 / Math.max(aspect, 0.4), 1, 2.2);
        want.sub(look).multiplyScalar(back).add(look);
      }
    }

    if (!seeded.current) {
      // First frame: snap, so the scene opens on the intended shot rather than
      // flying in from wherever the Canvas default camera happened to be.
      pos.current.copy(want);
      target.current.copy(look);
      fov.current = pose.fov ?? (camera as THREE.PerspectiveCamera).fov;
      seeded.current = true;
    } else {
      const k = 1 - Math.exp(-ease * dt);
      pos.current.lerp(want, k);
      target.current.lerp(look, k);
      if (pose.fov !== undefined) fov.current = damp(fov.current, pose.fov, ease, dt);
    }

    camera.position.copy(pos.current);

    if (parallax) {
      const yaw = THREE.MathUtils.degToRad(parallax.yaw) * -pointer.current.x;
      const pitch = THREE.MathUtils.degToRad(parallax.pitch) * -pointer.current.y;
      // Orbit the camera a little around the look-at point rather than rotating
      // in place: the subject stays put and the room moves, which is what a
      // slight head movement actually looks like.
      const offset = camera.position.clone().sub(target.current);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const right = offset.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
      offset.applyAxisAngle(right, pitch);
      camera.position.copy(target.current).add(offset);
    }

    camera.lookAt(target.current);

    const persp = camera as THREE.PerspectiveCamera;
    if (Math.abs(persp.fov - fov.current) > 0.01) {
      persp.fov = fov.current;
      persp.updateProjectionMatrix();
    }

    if (!ready.current) {
      ready.current = true;
      onReady?.();
    }

    /* Keep a frameloop="demand" scene rendering for as long as the camera is
       still moving, then let it go quiet. Without this the easing would render
       exactly one frame and freeze part-way through a transition. */
    const settled =
      pos.current.distanceToSquared(want) < 1e-8 &&
      target.current.distanceToSquared(look) < 1e-8 &&
      (pose.fov === undefined || Math.abs(fov.current - pose.fov) < 0.01);
    if (!settled) invalidate();
  });

  return null;
}
