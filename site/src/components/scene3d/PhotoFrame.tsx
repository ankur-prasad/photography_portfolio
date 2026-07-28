/* ============================================================================
   PhotoFrame — one photograph hung on a wall, used by both new 3D scenes.

   /work hangs 20 of these in the rotunda's baked frame envelopes; /prints hangs
   exactly one, sized to the real centimetres of the selected SKU. Same
   component, because "a photo, matted, framed, glazed, lit, on a wall" is the
   same object in both places — only where the dimensions come from differs:

     gallery → envW/envH: mat the photo inside a fixed frame opening
     room    → printW/printH: the photo IS this many metres, frame goes around

   Texture tiering is imperative (see photoTextureCache): this component polls
   the cache from useFrame and assigns material.map itself, so a photo arriving
   never re-renders React. Only prop changes do.
   ========================================================================== */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { type Vec3, faceRotation, fitInside, damp } from "../../data/sceneScript";
import { type Tier, acquire, bestAtOrBelow, release } from "./photoTextureCache";
import {
  brushedTexture,
  makeMouldingGeometry,
  makeMountGeometry,
  paperTexture,
  weaveTexture,
  woodTexture,
} from "./frameCraft";

export type Chrome = "print" | "box-frame" | "canvas" | "framed-canvas" | "acrylic" | "dibond";

export interface PhotoFrameProps {
  /** `/web/<stem>.jpg` — also the photo's id everywhere else on the site */
  src: string;
  /** width/height of the photograph, from photos.json meta (w/h) */
  aspect: number;

  centre: Vec3;
  normal: Vec3;

  /** Gallery mode: mat the photo inside this frame opening (metres). */
  envW?: number;
  envH?: number;
  /** Room mode: the photograph is exactly this big (metres). Wins over env*. */
  printW?: number;
  printH?: number;

  chrome?: Chrome;
  /** frame bar width in metres (0 = frameless) */
  frameM?: number;
  frameColor?: string;
  /** mount/passe-partout width in metres */
  mountM?: number;
  /** how far the whole assembly floats off the wall */
  standoffM?: number;

  /** distance-driven texture tiering; pass a fixed tier to opt out */
  tier?: Tier | "auto";
  /** cache scope — one per scene, released together on unmount */
  scope: string;

  onSelect?: (src: string) => void;
  /** lerp size changes rather than popping (the /prints size chips) */
  animateSize?: boolean;
  /** render the photo unlit and untonemapped, for colour A/B (?flat) */
  flat?: boolean;
  /** fake soft contact shadow behind the frame */
  contactShadow?: boolean;
}

const MOUNT_HEX = "#f2efe8"; // warm gallery mount board

/** Physical depth of the object, by finish — a box frame is ~30 mm deep, a
 *  stretched canvas ~35 mm, acrylic 8 mm, dibond 3 mm. */
function depthFor(chrome: Chrome): number {
  switch (chrome) {
    case "canvas":
    case "framed-canvas":
      return 0.035;
    case "acrylic":
      return 0.008;
    case "dibond":
      return 0.003;
    default:
      return 0.03;
  }
}

export default function PhotoFrame({
  src,
  aspect,
  centre,
  normal,
  envW,
  envH,
  printW,
  printH,
  chrome = "box-frame",
  frameM = 0,
  frameColor = "#111112",
  mountM = 0,
  standoffM = 0.004,
  tier = "auto",
  scope,
  onSelect,
  animateSize = false,
  flat = false,
  contactShadow = true,
}: PhotoFrameProps) {
  const groupRef = useRef<THREE.Group>(null);
  const photoMat = useRef<THREE.MeshStandardMaterial | THREE.MeshBasicMaterial | null>(null);
  const appliedTex = useRef<THREE.Texture | null>(null);
  const appliedTier = useRef<Tier | null>(null);
  const heldTier = useRef<Tier | null>(null);
  /** which src the held references belong to, so a photo change releases the
   *  right entries and re-acquires for the new one */
  const heldSrc = useRef<string | null>(null);
  const tick = useRef(0);
  const scaleCur = useRef(1);

  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);

  /* ---- geometry --------------------------------------------------------- */

  const dims = useMemo(() => {
    // Room mode: exact print size. Gallery mode: largest fit inside the opening.
    let w: number;
    let h: number;
    if (printW && printH) {
      w = printW;
      h = printH;
    } else {
      const opening = {
        w: Math.max(0.01, (envW ?? 1) - 2 * (frameM + mountM)),
        h: Math.max(0.01, (envH ?? 1) - 2 * (frameM + mountM)),
      };
      const fit = fitInside(aspect, opening.w, opening.h);
      w = fit.w;
      h = fit.h;
    }
    // Canvas wraps have no mount, and their photo is the full face.
    const showMount = mountM > 0 && chrome !== "canvas" && chrome !== "acrylic" && chrome !== "dibond";
    const m = showMount ? mountM : 0;
    return {
      w,
      h,
      mount: m,
      openW: w + 2 * m,
      openH: h + 2 * m,
      outerW: w + 2 * (m + frameM),
      outerH: h + 2 * (m + frameM),
    };
  }, [aspect, envW, envH, printW, printH, frameM, mountM, chrome]);

  const rotation = useMemo(() => faceRotation(normal), [normal]);

  /* Geometry depends on the configured size, so it is rebuilt when that changes
     and disposed on the way out — these are generated, not shared. */
  const showFrame = frameM > 0.0005;

  const mouldingGeo = useMemo(() => {
    if (!showFrame) return null;
    return makeMouldingGeometry(dims.outerW, dims.outerH, frameM, depthFor(chrome));
  }, [showFrame, dims.outerW, dims.outerH, frameM, chrome]);

  const mountGeo = useMemo(() => {
    if (dims.mount <= 0) return null;
    return makeMountGeometry(dims.openW, dims.openH, dims.w, dims.h);
  }, [dims.mount, dims.openW, dims.openH, dims.w, dims.h]);

  useEffect(() => {
    return () => {
      mouldingGeo?.dispose();
      mountGeo?.dispose();
    };
  }, [mouldingGeo, mountGeo]);

  const depth = depthFor(chrome);

  /* ---- materials -------------------------------------------------------- */

  const mats = useMemo(() => {
    /* Frame surface. A flat colour is what made corners read as black
       rectangles; grain (or brush marks on metal) plus a bump map is what makes
       the profile look like a physical object under the picture light. */
    const isMetal = chrome === "dibond";
    const grain = isMetal ? brushedTexture() : woodTexture();
    const frame = new THREE.MeshStandardMaterial({
      color: new THREE.Color(frameColor),
      map: grain, // greyscale, so it tints to the chosen frame colour
      bumpMap: grain,
      bumpScale: isMetal ? 0.35 : 0.6,
      roughnessMap: grain,
      roughness: isMetal ? 0.34 : 0.52,
      metalness: isMetal ? 0.62 : 0.06,
      envMapIntensity: isMetal ? 0.9 : 0.35,
    });
    const paper = paperTexture();
    const mount = new THREE.MeshStandardMaterial({
      color: new THREE.Color(MOUNT_HEX),
      bumpMap: paper,
      bumpScale: 0.25,
      roughness: 0.94,
      metalness: 0,
      envMapIntensity: 0.2,
    });
    /* The photo. toneMapped:false keeps the customer's pixels out of the
       renderer's ACES curve — someone judging print colour must not be shown a
       tone-mapped approximation — while still receiving the picture light so
       the scene reads as a real room. ?flat swaps in an unlit material to A/B
       exactly how much the lighting is shifting things. */
    const photo = flat
      ? new THREE.MeshBasicMaterial({ toneMapped: false })
      : new THREE.MeshStandardMaterial({
          roughness: chrome === "acrylic" || chrome === "dibond" ? 0.28 : 0.86,
          metalness: 0,
          envMapIntensity: 0.15,
          toneMapped: false,
          /* Surface of the print itself: canvas weave, or the tooth of cotton
             rag paper. Bump only — it must never tint the photograph. */
          bumpMap:
            chrome === "canvas" || chrome === "framed-canvas"
              ? weaveTexture()
              : chrome === "acrylic" || chrome === "dibond"
                ? null
                : paperTexture(),
          bumpScale: chrome === "canvas" || chrome === "framed-canvas" ? 0.5 : 0.14,
        });
    /* Glazing. Deliberately NOT MeshPhysicalMaterial transmission: the camera
       act's frontGlass comment records that transmission renders as a near
       opaque void in a dim scene. A low-opacity specular sheet reads better and
       costs nothing. */
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: chrome === "acrylic" ? 0.14 : 0.07,
      roughness: chrome === "acrylic" ? 0.02 : 0.08,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      depthWrite: false,
    });
    const shadow = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    return { frame, mount, photo, glass, shadow };
  }, [frameColor, chrome, flat]);

  useEffect(() => {
    photoMat.current = mats.photo;
    // Re-apply on material identity change (chrome/?flat switch).
    appliedTex.current = null;
    return () => {
      for (const m of Object.values(mats)) m.dispose();
    };
  }, [mats]);

  /* ---- texture tiering -------------------------------------------------- */

  const worldCentre = useMemo(() => new THREE.Vector3(...centre), [centre]);

  // Release everything this frame was holding when src/scope changes or it
  // unmounts, so the cache can evict it.
  useEffect(() => {
    return () => {
      if (heldTier.current) release(src, heldTier.current, scope);
      release(src, "thumb", scope);
      heldTier.current = null;
      heldSrc.current = null;
    };
  }, [src, scope]);

  useFrame((_, dt) => {
    // Every 6th frame is plenty — tiers only change when crossing a distance
    // threshold, and this runs for every canvas in the scene.
    if (tick.current++ % 6 === 0) {
      let want: Tier;
      if (tier !== "auto") want = tier;
      else {
        const d = camera.position.distanceTo(worldCentre);
        want = d < 4.5 ? "web" : d < 11 ? "mid" : "thumb";
      }

      /* A NEW photograph needs to appear immediately, not when its
         full-resolution file finishes downloading. Until it does,
         bestAtOrBelow() finds nothing for the new src and the material keeps the
         PREVIOUS photo's texture — which looks exactly like the click did
         nothing. So always hold the thumb tier as a floor: it is 480px, it is
         usually already in the browser cache because the picker strip rendered
         it as an <img>, and it lands within a frame or two. The sharp tier then
         replaces it invisibly. */
      if (heldSrc.current !== src) {
        if (heldSrc.current) {
          if (heldTier.current) release(heldSrc.current, heldTier.current, scope);
          release(heldSrc.current, "thumb", scope);
        }
        acquire(src, "thumb", scope, aspect);
        heldSrc.current = src;
        heldTier.current = null;
        // Force the next comparison to adopt whatever exists for the new photo.
        appliedTex.current = null;
        appliedTier.current = null;
      }

      if (heldTier.current !== want) {
        if (heldTier.current) release(src, heldTier.current, scope);
        acquire(src, want, scope, aspect);
        heldTier.current = want;
      }

      const best = bestAtOrBelow(src, want);
      const mat = photoMat.current;
      if (mat && best && (best.texture !== appliedTex.current || best.tier !== appliedTier.current)) {
        mat.map = best.texture;
        mat.needsUpdate = true;
        appliedTex.current = best.texture;
        appliedTier.current = best.tier;
        invalidate();
      }
      /* A texture arriving is an async event outside the render loop, so on a
         frameloop="demand" scene keep asking for frames until the tier we want
         is actually on screen — otherwise the photo silently never appears. */
      if (appliedTier.current !== want) invalidate();
    }

    // Size changes (a new /prints SKU) grow rather than pop.
    if (animateSize && groupRef.current) {
      scaleCur.current = damp(scaleCur.current, 1, 9, dt);
      const s = scaleCur.current;
      groupRef.current.scale.set(s, s, 1);
      if (Math.abs(1 - s) > 0.0005) invalidate();
    }
  });

  // Restart the grow animation whenever the physical size changes.
  useEffect(() => {
    if (!animateSize) return;
    scaleCur.current = 0.88;
  }, [dims.outerW, dims.outerH, animateSize]);

  /* ---- assembly ---------------------------------------------------------
     Local space: the group is rotated so +Z points out of the wall at the
     viewer. Everything stacks along +Z from the wall face outward. */

  /* Stack outward along +Z from the wall face:
       standoff → substrate slab (if any) → photo → glazing
     The photo MUST clear the front of the substrate. Sitting it at a fixed
     small offset instead put it *inside* the slab for acrylic and dibond, and
     the slab's dark backing drew over it — the print rendered as a black
     rectangle. */
  const hasSubstrate =
    chrome === "canvas" || chrome === "framed-canvas" || chrome === "acrylic" || chrome === "dibond";
  const zSubstrateCentre = standoffM + depth / 2;
  const zPhoto = standoffM + (hasSubstrate ? depth : 0) + 0.0008;
  /* Glazing sits in the frame's front rabbet when there is a frame, and directly
     on the print when the acrylic IS the surface. */
  const showGlass = chrome === "box-frame" || chrome === "framed-canvas" || chrome === "acrylic";
  const zGlass = showFrame ? standoffM + depth - 0.0025 : zPhoto + 0.0015;

  return (
    <group ref={groupRef} position={centre} rotation={rotation}>
      {/* Soft grounding shadow. A real shadow map for 20 canvases costs more
          than it adds; this reads correctly and is one transparent quad. */}
      {contactShadow && (
        <mesh position={[0, -0.01, standoffM * 0.5]} material={mats.shadow} raycast={() => {}}>
          <planeGeometry args={[dims.outerW * 1.08, dims.outerH * 1.06]} />
        </mesh>
      )}

      {/* Stretcher body for canvas finishes — textured with the photo so the
          sides read as a wrapped edge. The photo quad sits just proud of its
          front face. */}
      {(chrome === "canvas" || chrome === "framed-canvas") && (
        <mesh position={[0, 0, zSubstrateCentre]} material={mats.photo} raycast={() => {}}>
          <boxGeometry args={[dims.w, dims.h, depth]} />
        </mesh>
      )}

      {/* Metal / acrylic substrate, float-mounted off the wall. Deliberately
          slightly smaller than the photo in-plane so it reads as a backing the
          print is mounted to rather than a border around it. */}
      {(chrome === "dibond" || chrome === "acrylic") && (
        <mesh position={[0, 0, zSubstrateCentre]} material={mats.frame} raycast={() => {}}>
          <boxGeometry args={[dims.w - 0.002, dims.h - 0.002, depth]} />
        </mesh>
      )}

      {/* Mount board with a 45° undercut window, so the white core shows as a
          bright line around the image the way a real cut mount does. */}
      {dims.mount > 0 && mountGeo && (
        <mesh
          position={[0, 0, zPhoto - 0.0016]}
          geometry={mountGeo}
          material={mats.mount}
          raycast={() => {}}
        />
      )}

      {/* The photograph. The only thing that takes pointer events. */}
      <mesh
        position={[0, 0, zPhoto]}
        material={mats.photo}
        onPointerDown={
          onSelect
            ? (e) => {
                e.stopPropagation();
                onSelect(src);
              }
            : undefined
        }
        onPointerOver={
          onSelect
            ? (e) => {
                e.stopPropagation();
                document.body.dataset.cursor = "view";
              }
            : undefined
        }
        onPointerOut={
          onSelect
            ? () => {
                delete document.body.dataset.cursor;
              }
            : undefined
        }
      >
        <planeGeometry args={[dims.w, dims.h]} />
      </mesh>

      {/* Glazing over the photo. */}
      {showGlass && (
        <mesh position={[0, 0, zGlass]} material={mats.glass} raycast={() => {}}>
          <planeGeometry args={[dims.openW, dims.openH]} />
        </mesh>
      )}

      {/* One extruded moulding rather than four boxes: the corners mitre for
          free, and the bevelled front and back edges catch the picture light
          instead of rendering as a flat silhouette. */}
      {showFrame && mouldingGeo && (
        <mesh
          position={[0, 0, standoffM]}
          geometry={mouldingGeo}
          material={mats.frame}
          raycast={() => {}}
        />
      )}
    </group>
  );
}
