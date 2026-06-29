import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { AnimatePresence, motion } from "framer-motion";
import * as THREE from "three";
import CameraModel from "./CameraModel";
import { PARTS, beatFor, clamp01, samplePose } from "../data/cameraScript";

/* the viewfinder flipbook — opens FULL-BLEED on water (ANK00641, "Surface"),
   riffles through a handful of frames, then LANDS on the eye close-up and
   holds, handing straight off to the "A camera mimics the eye" caption (timing
   in viewfinderIndexFor / EYE_LAND_P). 2560px retina-grade set (tools
   regenerated from /photos/ originals into /viewfinder/) so the full-bleed
   hero and the held eye stay crisp on hi-DPI screens. ViewfinderPhoto streams
   these progressively — only the first frame gates the canvas, the rest load
   in the background — so the heavier set doesn't slow first paint. */
const VIEWFINDER_CYCLE = [
  "/viewfinder/ANK00641.jpg", // Surface — water (start, full-bleed)
  "/viewfinder/ANK09879.jpg",
  "/viewfinder/ANK01938.jpg",
  "/viewfinder/ANK09500.jpg",
  "/viewfinder/ANK09212.jpg",
  "/viewfinder/ANK08837.jpg",
  "/viewfinder/ANK03010.jpg",
  "/viewfinder/ANK02879.jpg", // The Eye (land + hold)
];

const DEBUG = typeof window !== "undefined" && window.location.search.includes("debug");

/* ---------- viewing-camera rig: flies to centre each part ---------- */
function CameraRig({ progress }: { progress: React.MutableRefObject<number> }) {
  const { camera } = useThree();
  const advance = useThree((s) => s.advance);
  const cur = useRef(0);
  const tgt = useRef(new THREE.Vector3(0, 0, -1));
  // debug: manually pump frames so static captures work even when the tab is
  // backgrounded (rAF is throttled when document.hidden)
  useEffect(() => {
    if (!DEBUG) return;
    (window as unknown as { __advance: (n?: number) => void }).__advance = (n = 4) => {
      for (let i = 0; i < n; i++) advance(performance.now() + i * 16);
    };
  }, [advance]);
  useFrame((_, dt) => {
    const ovr = DEBUG ? (window as unknown as { __ovr?: { pos: number[]; target: number[] } }).__ovr : undefined;
    if (ovr) {
      camera.position.set(ovr.pos[0], ovr.pos[1], ovr.pos[2]);
      camera.lookAt(ovr.target[0], ovr.target[1], ovr.target[2]);
      return;
    }
    // Track scroll tightly — Lenis already eases the scroll position, so a
    // heavy second smoothing here only adds lag (see CameraModel for the same
    // fix). The viewing camera now arrives at each part's shot in step with the
    // scroll instead of trailing ~0.2s behind it.
    cur.current += (progress.current - cur.current) * (DEBUG ? 1 : Math.min(1, dt * 18));
    const { pos, target } = samplePose(cur.current);
    camera.position.set(pos[0], pos[1], pos[2]);
    tgt.current.set(target[0], target[1], target[2]);
    camera.lookAt(tgt.current);
  });
  return null;
}

/* phase boundaries (p is local scroll progress through .camera-act; HUD frame
   number ≈ p * 1833.3): "hero" title fades out at frame 75 (p 0.04092), the
   "Pull back..." caption joins at frame 86 (p 0.04692) — leaving a brief,
   caption-free "pause" window — and hands off to beat 1's "PART 01 / 06
   VIEWFINDER" card exactly at frame 200 (p 0.10909, also beatFor's threshold)
   so the two captions never overlap. */
function phaseFor(p: number): "hero" | "pause" | "reveal" | "parts" | "thesis" | "handoff" {
  if (p < 0.04092) return "hero";
  if (p < 0.04692) return "pause";
  if (p < 0.10909) return "reveal";
  if (p < 0.93) return "parts";
  if (p < 0.97) return "thesis";
  return "handoff";
}

export default function CameraExperience() {
  const section = useRef<HTMLElement>(null);
  const progress = useRef(0);
  const [beat, setBeat] = useState(0);
  const [phase, setPhase] = useState<ReturnType<typeof phaseFor>>("hero");

  useEffect(() => {
    let raf = 0;
    let queued = false;
    const update = () => {
      queued = false;
      if (DEBUG && (window as unknown as { __pauseScroll?: boolean }).__pauseScroll) return;
      const el = section.current;
      if (!el) return;
      const total = el.offsetHeight - window.innerHeight;
      const p = total > 0 ? clamp01(-el.getBoundingClientRect().top / total) : 0;
      progress.current = p;

      const b = beatFor(p);
      setBeat((prev) => (prev === b ? prev : b));
      setPhase((prev) => { const ph = phaseFor(p); return prev === ph ? prev : ph; });
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      raf = requestAnimationFrame(update);
    };
    update();
    if (DEBUG) {
      (window as unknown as { __setP: (p: number) => void; __pauseScroll?: boolean }).__setP = (p: number) => {
        (window as unknown as { __pauseScroll?: boolean }).__pauseScroll = true;
        progress.current = p;
        setBeat(beatFor(p));
        setPhase(phaseFor(p));
      };
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const part = beat >= 1 && beat <= 6 ? PARTS[beat - 1] : null;

  // High-DPR phone GPUs rendering WebGL at native 3x is the main mobile perf
  // killer — cap the upper bound to 1.5 on small screens (imperceptible, much
  // lighter). Desktop keeps the full 2x.
  const dprMax =
    typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 768 ? 1.5 : 2;

  return (
    <section className="camera-act" ref={section}>
      <div className="camera-stage">
        <div className="camera-canvas">
          <Canvas
            dpr={[1, dprMax]}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            camera={{ fov: 42, near: 0.02, far: 100, position: [0, 0.1, -1.6] }}
            onCreated={(state) => {
              if (DEBUG) (window as unknown as { __r3f?: unknown }).__r3f = state;
            }}
          >
            <Suspense fallback={null}>
              <CameraRig progress={progress} />
              <ambientLight intensity={0.6} />
              <directionalLight position={[3, 4, 2]} intensity={2.1} />
              <directionalLight position={[-3, 1.5, -2]} intensity={0.9} color="#f0a060" />
              {/* cool rim from behind to separate the black body from the black bg */}
              <directionalLight position={[-1.5, 2.5, -3.5]} intensity={1.8} color="#bcd2ff" />
              <directionalLight position={[2.5, -1, -3]} intensity={1.0} color="#f0883e" />
              <Environment resolution={128}>
                <Lightformer form="rect" intensity={4} position={[-2.5, 2, 3]} scale={[4, 4, 1]} color="#fff0dd" />
                <Lightformer form="rect" intensity={2.2} position={[3, 1, 2.5]} scale={[3, 4, 1]} color="#9bb8ff" />
                <Lightformer form="rect" intensity={2.4} position={[0, -2, -3]} scale={[6, 3, 1]} color="#ffffff" />
                <Lightformer form="ring" intensity={2.6} position={[2.5, 0.5, -2]} scale={2} color="#f0883e" />
              </Environment>
              <CameraModel progress={progress} beat={beat} photos={VIEWFINDER_CYCLE} debug={DEBUG} />
            </Suspense>
          </Canvas>
        </div>

        <div className="camera-veil" />

        {/* ---------- hero copy ---------- */}
        <div className="act-hero" style={{ opacity: phase === "hero" ? 1 : 0, transition: "opacity 0.6s" }}>
          <div className="container">
            <p className="act-hero-kicker">Photographer × AI Engineer — Munich</p>
            <h1 className="act-hero-title" aria-label="Ankur Prasad">
              <span className="line">Ankur</span>
              <span className="line">Prasad</span>
            </h1>
            <p className="act-hero-sub">
              I notice what the eye would miss — and freeze it into a single frame.
            </p>
          </div>
        </div>

        {/* ---------- reveal caption ---------- */}
        <div
          className="act-thesis"
          style={{ opacity: phase === "reveal" ? 1 : 0, transition: "opacity 0.6s", pointerEvents: "none" }}
        >
          {phase === "reveal" && (
            <p className="long">
              A camera mimics the eye. The only difference —{" "}
              <span className="accent">the eye sees what the brain decides to notice</span>. A camera sees what you
              point it at.
            </p>
          )}
        </div>

        {/* ---------- per-part narration ---------- */}
        <AnimatePresence mode="wait">
          {part && (
            <motion.div
              key={part.no}
              className={`act-copy ${part.side}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="eyebrow">PART {part.no} / 06</p>
              <h3>
                {part.name}
                <small>↳ {part.eye}</small>
              </h3>
              <p>{part.body}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---------- thesis ---------- */}
        <div
          className="act-thesis"
          style={{ opacity: phase === "thesis" || phase === "handoff" ? 1 : 0, transition: "opacity 0.7s" }}
        >
          {(phase === "thesis" || phase === "handoff") && (
            <p>
              One tool to freeze time in a single frame.
              <br />
              And these are some moments <span className="accent">I decided to freeze.</span>
            </p>
          )}
        </div>

        {/* ---------- scroll hint ---------- */}
        <div className="act-scroll-hint" style={{ opacity: phase === "hero" ? 1 : 0, transition: "opacity 0.5s" }}>
          <span className="dot" />
          scroll — the image is alive
        </div>
      </div>
    </section>
  );
}
