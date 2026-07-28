/* ============================================================================
   canRender3D — should this browser get a WebGL scene at all?

   Until now the only guard on the home page's 3D act was an ErrorBoundary,
   which means a browser without WebGL constructs a Canvas, throws, and flashes
   before falling back. These probes let callers decide before mounting.

   Two gates, because the costs differ by an order of magnitude:
     canRenderWebGL()   — is WebGL2 usable at all (home's 2.3 MB camera)
     canRenderHeavy3D() — should we also pull a whole room/gallery scene, which
                          is a multi-megabyte download competing with the
                          photographs those pages exist to show
   ========================================================================== */

export interface Caps {
  webgl2: boolean;
  renderer: string;
  /** software rasteriser — technically WebGL, useless in practice */
  softwareGL: boolean;
  deviceMemory: number;
  cores: number;
  mobile: boolean;
  reduced: boolean;
  saveData: boolean;
  slowNet: boolean;
}

/* Software rasterisers report themselves here. They will happily run a scene at
   3 fps, which is worse than a clean fallback. */
const SOFTWARE_GL = /swiftshader|llvmpipe|software|basic render|microsoft basic/i;

let cached: Caps | null = null;

export function probeCaps(): Caps {
  if (cached) return cached;

  if (typeof window === "undefined") {
    cached = {
      webgl2: false, renderer: "", softwareGL: false, deviceMemory: 0,
      cores: 0, mobile: false, reduced: false, saveData: false, slowNet: false,
    };
    return cached;
  }

  let webgl2 = false;
  let renderer = "";
  try {
    // Throwaway context: created, read, and immediately released. Some drivers
    // cap the number of live contexts, and this page will want its real one.
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false });
    if (gl) {
      webgl2 = true;
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      if (info) renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? "");
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    webgl2 = false;
  }

  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  const conn = nav.connection;

  cached = {
    webgl2,
    renderer,
    softwareGL: SOFTWARE_GL.test(renderer),
    deviceMemory: nav.deviceMemory ?? 0,
    cores: navigator.hardwareConcurrency ?? 0,
    mobile:
      window.matchMedia("(pointer: coarse)").matches &&
      Math.min(window.innerWidth, window.innerHeight) < 820,
    reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    saveData: conn?.saveData === true,
    slowNet: /(^|-)2g$/.test(conn?.effectiveType ?? ""),
  };
  return cached;
}

/** ?force3d=1 / ?no3d=1 always win, so any gate can be tested on any machine. */
function override(): boolean | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  if (q.has("no3d")) return false;
  if (q.has("force3d")) return true;
  return null;
}

/** Light gate: enough to run the home page's camera act. */
export function canRenderWebGL(): boolean {
  const o = override();
  if (o !== null) return o;
  const c = probeCaps();
  return c.webgl2 && !c.softwareGL;
}

/**
 * Strict gate for the /work gallery and /prints room.
 *
 * Deliberately stricter than canRenderWebGL: these scenes are several MB that
 * compete for bandwidth with the photographs and, on /prints, with a checkout
 * flow. When in doubt the DOM version is genuinely good — it is instant,
 * accessible and to-scale — so this fails closed.
 *
 * deviceMemory/hardwareConcurrency are absent on Safari; treat 0 as "unknown"
 * and let it pass rather than excluding every Mac and iPhone by default.
 */
export function canRenderHeavy3D(): boolean {
  const o = override();
  if (o !== null) return o;
  const c = probeCaps();
  if (!c.webgl2 || c.softwareGL) return false;
  if (c.reduced || c.saveData || c.slowNet) return false;
  if (c.mobile) return false;
  if (c.deviceMemory && c.deviceMemory < 4) return false;
  if (c.cores && c.cores < 4) return false;
  return true;
}
