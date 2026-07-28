/* ============================================================================
   RoomScene — the /prints living room, and the print hanging in it.

   The camera holds one of the framings in roomScript's ROOM_SHOTS, chosen by the
   configurator panel, with a little pointer parallax on top.

   The print's size, chrome and colour all come from usePrintConfig, the same
   hook the 2D fallback uses, so the two views can never disagree about what is
   being sold. Nothing here touches the Stripe path.
   ========================================================================== */

import { useEffect, useMemo } from "react";
import { useGLTF, Environment, Lightformer } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import Scene3DShell from "./scene3d/Scene3DShell";
import FlightRig from "./scene3d/FlightRig";
import Invalidate from "./scene3d/Invalidate";
import ProjectedAnchor from "./scene3d/ProjectedAnchor";
import PhotoFrame, { type Chrome } from "./scene3d/PhotoFrame";
import { releaseScope } from "./scene3d/photoTextureCache";
import {
  DETAIL_VIEWS,
  PAINTING_NODES,
  PRINT_WALL,
  ROOM_ANCHORS,
  ROOM_LIGHTS,
  ROOM_SHOTS,
  ROOM_URL,
  detailShot,
} from "../data/roomScript";
import { MOUNT_CM, COLOR_HEX, dimsFor, type CatalogFinish, type CatalogSize } from "../data/printConfig";
import { vadd, vscale, type Vec3 } from "../data/sceneScript";

useGLTF.preload(ROOM_URL);

const SCOPE = "prints-room";

export interface RoomSceneProps {
  src: string;
  size: CatalogSize;
  finish: CatalogFinish;
  color?: string;
  aspect: number;
  /** 0..1 across ROOM_SHOTS, written by the framing switcher */
  progressRef: { current: number };
  /** key of an active per-finish close-up, or null for the room framings */
  detail?: string | null;
  onReady?: () => void;
}

/** The GLB, rendered straight from the useGLTF cache WITHOUT cloning: a clone
 *  shares geometry with that cache, so disposing it blanks the model on the next
 *  mount — the classic "renders once, blank after navigating back" bug. */
function RoomModel() {
  const { scene } = useGLTF(ROOM_URL);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    scene.traverse((o) => {
      // Scenery. Killing raycast stops the walls swallowing pointer events meant
      // for the print, and removes a six-figure-triangle raycast per pointer move.
      o.raycast = () => {};
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = true;
      }
    });

    // Safety net for an unpruned build. By NAME, never by material: `Black` and
    // `GlassD1` are shared with six unrelated objects.
    for (const name of PAINTING_NODES) scene.getObjectByName(name)?.removeFromParent();

    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
  }, [scene, gl]);

  return <primitive object={scene} />;
}

/**
 * The picture light.
 *
 * Broken out because SpotLight aiming has a trap: `light.target` is an Object3D
 * that three does NOT add to the scene, so moving it has no effect until it is
 * parented — its matrixWorld never updates and the light keeps pointing at the
 * world origin. That is exactly what happened here: the hotspot landed high on
 * the wall above the print and the print itself read dim. Adding the target as a
 * primitive fixes the aim.
 */
function PictureLight() {
  const target = useMemo(() => new THREE.Object3D(), []);
  return (
    <>
      <primitive object={target} position={[...PRINT_WALL.centre] as [number, number, number]} />
      <spotLight
        position={ROOM_LIGHTS.picture.position}
        target={target}
        intensity={ROOM_LIGHTS.picture.intensity}
        angle={ROOM_LIGHTS.picture.angle}
        penumbra={ROOM_LIGHTS.picture.penumbra}
        distance={ROOM_LIGHTS.picture.distance}
        decay={ROOM_LIGHTS.picture.decay}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0005}
      />
    </>
  );
}

export default function RoomScene({
  src,
  size,
  finish,
  color,
  aspect,
  progressRef,
  detail,
  onReady,
}: RoomSceneProps) {
  const debug = typeof window !== "undefined" && window.location.search.includes("debug");
  const flat = typeof window !== "undefined" && window.location.search.includes("flat");

  /* Model units are metres (verified against the measured room bounds), so
     cm/100 is the whole conversion. */
  const dims = dimsFor(size, aspect);
  const printW = dims.w / 100;
  const printH = dims.h / 100;
  const frameM = finish.frameCm / 100;
  const mountM = (MOUNT_CM[finish.type] ?? 0) / 100;
  const frameColor = color && COLOR_HEX[color] ? COLOR_HEX[color] : "#141416";

  /* Where the anchored DOM panels track. The edge point is half the print's
     width away along the wall, so the panel can offset itself by the print's
     actual on-screen size instead of a guessed pixel value. */
  const outerHalfW = printW / 2 + mountM + frameM;
  const anchorEdge = useMemo<Vec3>(
    () => vadd(PRINT_WALL.centre as Vec3, vscale(PRINT_WALL.right as Vec3, outerHalfW)),
    [outerHalfW]
  );

  /* A close-up resolves to a single shot, framed against the print's real
     geometry so it lands on the same feature at any size. FlightRig holds a
     one-shot list at any progress, and eases into it from wherever it was. */
  const shots = useMemo(() => {
    if (!detail) return ROOM_SHOTS;
    const view = (DETAIL_VIEWS[finish.type] ?? []).find((v) => v.key === detail);
    if (!view) return ROOM_SHOTS;
    return [
      detailShot(view, {
        centre: PRINT_WALL.centre as Vec3,
        right: PRINT_WALL.right as Vec3,
        up: PRINT_WALL.up as Vec3,
        normal: PRINT_WALL.normal as Vec3,
        halfW: outerHalfW,
        halfH: printH / 2 + mountM + frameM,
      }),
    ];
  }, [detail, finish.type, outerHalfW, printH, mountM, frameM]);

  useEffect(() => () => releaseScope(SCOPE), []);

  return (
    <Scene3DShell
      scene="room"
      className="room-3d-canvas"
      /* The camera is moving for most of this page, so an always-on loop is
         both simpler and honest. AdaptiveDpr in the shell handles weak GPUs. */
      frameloop="always"
      camera={{ fov: 55, near: 0.05, far: 60, position: [1.1, 1.75, 5.6] }}
      debug={debug}
    >
      <Invalidate on={[src, size.sku, finish.key, color, printW, printH, flat, detail]} />

      <FlightRig
        progressRef={progressRef}
        anchors={ROOM_ANCHORS}
        shots={shots}
        ease={5.5}
        /* Gentle pointer parallax so a stationary scroll position still feels
           alive. Deliberately not OrbitControls — a configurator where the
           customer can lose the print is a bad configurator. */
        parallax={{ yaw: 3.5, pitch: 1.8 }}
        aspectFit
        onReady={onReady}
      />

      {/* Publishes the print's live screen rect as --print-x/y/w. Nothing reads
          it yet; it is the input for the home→prints photo handoff, where the
          photo clicked in the lightbox has to land exactly where the print is. */}
      <ProjectedAnchor centre={PRINT_WALL.centre as Vec3} edge={anchorEdge} prefix="print" />

      <RoomModel />

      <ambientLight intensity={ROOM_LIGHTS.ambient} />
      <directionalLight
        position={ROOM_LIGHTS.window.position}
        color={ROOM_LIGHTS.window.color}
        intensity={ROOM_LIGHTS.window.intensity}
      />
      <PictureLight />
      <pointLight
        position={ROOM_LIGHTS.lamp.position}
        color={ROOM_LIGHTS.lamp.color}
        intensity={ROOM_LIGHTS.lamp.intensity}
        distance={ROOM_LIGHTS.lamp.distance}
      />
      {/* Gives the glazing, acrylic and metal something to reflect. */}
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={1.6} position={[3, 3, 3]} scale={[4, 4, 1]} color="#eef4ff" />
        <Lightformer form="rect" intensity={0.7} position={[-2, 3.5, 3.4]} scale={[2, 2, 1]} color="#ffe6c4" />
      </Environment>

      <PhotoFrame
        src={src}
        aspect={aspect}
        centre={PRINT_WALL.centre as Vec3}
        normal={PRINT_WALL.normal as Vec3}
        printW={printW}
        printH={printH}
        chrome={finish.type as Chrome}
        frameM={frameM}
        mountM={mountM}
        frameColor={frameColor}
        standoffM={finish.type === "dibond" ? 0.02 : 0.004}
        /* One print, always the subject — no reason to tier it down. */
        tier="web"
        scope={SCOPE}
        animateSize
        flat={flat}
        contactShadow={false /* the picture light casts a real one here */}
      />
    </Scene3DShell>
  );
}
