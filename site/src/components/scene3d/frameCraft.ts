/* ============================================================================
   frameCraft — geometry and materials that hold up in close-up.

   The first pass drew frames as four flat-coloured boxes. That reads fine from
   across a room and falls apart the moment you look at a corner: no mitre, no
   chamfer, no grain, no weave — a black rectangle. This module supplies the two
   things that fix it:

     1. A real moulding: one extruded profile with bevelled front and back
        edges, so corners mitre correctly and the edges catch a highlight.
     2. Procedural surface detail: wood grain, canvas weave, brushed metal and
        paper tooth, generated on a <canvas> at runtime.

   Procedural rather than downloaded because these are small, tileable, need no
   licence, add nothing to the bundle, and can be tinted to any frame colour the
   catalogue offers. They will not match studio photography of real materials —
   nothing procedural will — but they turn "flat rectangle" into something with
   a surface.

   Everything is cached at module scope: one wood texture serves every frame.
   ========================================================================== */

import * as THREE from "three";

/* ------------------------------------------------------------- geometry --- */

/**
 * A picture-frame moulding: a rectangular ring, extruded with a bevel.
 *
 * Built as one shape with a hole rather than four boxes, which gives true mitred
 * corners for free. The bevel is what makes the profile read — a hard 90° edge
 * renders as a flat silhouette, a chamfered one picks up the picture light.
 *
 * The geometry spans z from 0 (against the wall) to `depth`, so callers position
 * it at the standoff and the front face lands at standoff + depth.
 */
export function makeMouldingGeometry(
  outerW: number,
  outerH: number,
  barW: number,
  depth: number
): THREE.BufferGeometry {
  const ow = outerW / 2;
  const oh = outerH / 2;
  const iw = Math.max(0.001, ow - barW);
  const ih = Math.max(0.001, oh - barW);

  const shape = new THREE.Shape();
  shape.moveTo(-ow, -oh);
  shape.lineTo(ow, -oh);
  shape.lineTo(ow, oh);
  shape.lineTo(-ow, oh);
  shape.closePath();

  const hole = new THREE.Path();
  hole.moveTo(-iw, -ih);
  hole.lineTo(iw, -ih);
  hole.lineTo(iw, ih);
  hole.lineTo(-iw, ih);
  hole.closePath();
  shape.holes.push(hole);

  /* Keep the bevel a fraction of the smallest dimension so a slim frame does
     not become all chamfer. */
  const bevel = Math.max(0.0006, Math.min(barW * 0.22, depth * 0.22, 0.005));

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, depth - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments: 2,
    curveSegments: 1,
  });
  // ExtrudeGeometry starts at -bevelThickness; shift so the span is 0..depth.
  geo.translate(0, 0, bevel);
  geo.computeVertexNormals();
  return geo;
}

/**
 * A mount board with a bevelled window.
 *
 * Real mount board is cut at ~45°, exposing the white core as a bright line
 * around the image. It is a small detail that reads immediately as "properly
 * framed", and its absence is part of why a flat quad looks like a screenshot.
 */
export function makeMountGeometry(
  openW: number,
  openH: number,
  windowW: number,
  windowH: number,
  bevelDepth = 0.0035
): THREE.BufferGeometry {
  const ow = openW / 2;
  const oh = openH / 2;
  const iw = Math.max(0.001, windowW / 2);
  const ih = Math.max(0.001, windowH / 2);

  const shape = new THREE.Shape();
  shape.moveTo(-ow, -oh);
  shape.lineTo(ow, -oh);
  shape.lineTo(ow, oh);
  shape.lineTo(-ow, oh);
  shape.closePath();

  const hole = new THREE.Path();
  hole.moveTo(-iw, -ih);
  hole.lineTo(iw, -ih);
  hole.lineTo(iw, ih);
  hole.lineTo(-iw, ih);
  hole.closePath();
  shape.holes.push(hole);

  // A negative bevelSize cuts inward, which is exactly a mount's undercut.
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.0012,
    bevelEnabled: true,
    bevelThickness: bevelDepth,
    bevelSize: -bevelDepth,
    bevelOffset: 0,
    bevelSegments: 1,
    curveSegments: 1,
  });
  geo.translate(0, 0, bevelDepth);
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------- textures --- */

const cache = new Map<string, THREE.Texture>();

function makeCanvas(size: number) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  return { c, ctx: c.getContext("2d")! };
}

function finish(key: string, canvas: HTMLCanvasElement, repeat: number) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  cache.set(key, tex);
  return tex;
}

/** Wood grain: long streaks with occasional darker rings. Greyscale, so it can
 *  be multiplied by any frame colour the catalogue offers. */
export function woodTexture(): THREE.Texture {
  const key = "wood";
  const hit = cache.get(key);
  if (hit) return hit;

  const S = 512;
  const { c, ctx } = makeCanvas(S);
  ctx.fillStyle = "#b9b9b9";
  ctx.fillRect(0, 0, S, S);

  // Fine grain along one axis.
  for (let i = 0; i < 2600; i++) {
    const y = Math.random() * S;
    const len = 40 + Math.random() * 300;
    const x = Math.random() * S;
    const light = Math.random() > 0.5;
    ctx.strokeStyle = light
      ? `rgba(255,255,255,${0.02 + Math.random() * 0.05})`
      : `rgba(0,0,0,${0.02 + Math.random() * 0.06})`;
    ctx.lineWidth = 0.6 + Math.random() * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + len * 0.4, y + (Math.random() - 0.5) * 3, x + len * 0.7, y + (Math.random() - 0.5) * 3, x + len, y);
    ctx.stroke();
  }
  // A few heavier rings so it does not read as pure noise.
  for (let i = 0; i < 7; i++) {
    const y = Math.random() * S;
    ctx.strokeStyle = `rgba(0,0,0,${0.06 + Math.random() * 0.07})`;
    ctx.lineWidth = 2 + Math.random() * 3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(S * 0.3, y + 6, S * 0.6, y - 6, S, y + 2);
    ctx.stroke();
  }
  return finish(key, c, 3);
}

/** Canvas weave: a crosshatch, for bump/roughness on stretched-canvas prints. */
export function weaveTexture(): THREE.Texture {
  const key = "weave";
  const hit = cache.get(key);
  if (hit) return hit;

  const S = 256;
  const { c, ctx } = makeCanvas(S);
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, S, S);
  const step = 4;
  for (let i = 0; i < S; i += step) {
    ctx.fillStyle = "rgba(255,255,255,0.20)";
    ctx.fillRect(i, 0, step / 2, S);
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.fillRect(i + step / 2, 0, step / 2, S);
  }
  // Perpendicular threads, half-strength, so it reads woven not striped.
  for (let i = 0; i < S; i += step) {
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(0, i, S, step / 2);
    ctx.fillStyle = "rgba(0,0,0,0.09)";
    ctx.fillRect(0, i + step / 2, S, step / 2);
  }
  return finish(key, c, 26);
}

/** Brushed metal: fine directional streaks, for Dibond. */
export function brushedTexture(): THREE.Texture {
  const key = "brushed";
  const hit = cache.get(key);
  if (hit) return hit;

  const S = 512;
  const { c, ctx } = makeCanvas(S);
  ctx.fillStyle = "#8c8c8c";
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 5200; i++) {
    const y = Math.random() * S;
    ctx.strokeStyle =
      Math.random() > 0.5
        ? `rgba(255,255,255,${0.015 + Math.random() * 0.05})`
        : `rgba(0,0,0,${0.015 + Math.random() * 0.045})`;
    ctx.lineWidth = 0.4 + Math.random() * 0.9;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(S, y + (Math.random() - 0.5) * 2);
    ctx.stroke();
  }
  return finish(key, c, 2);
}

/** Paper tooth: very fine noise, for the cotton-rag surface of a bare print. */
export function paperTexture(): THREE.Texture {
  const key = "paper";
  const hit = cache.get(key);
  if (hit) return hit;

  const S = 256;
  const { c, ctx } = makeCanvas(S);
  const img = ctx.createImageData(S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 118 + Math.random() * 22;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return finish(key, c, 40);
}

/** Drop every generated texture. Only for tests/HMR — these are shared. */
export function disposeFrameTextures() {
  for (const t of cache.values()) t.dispose();
  cache.clear();
}
