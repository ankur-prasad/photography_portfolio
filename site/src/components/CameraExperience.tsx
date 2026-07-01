import { Suspense, useEffect, useRef, useState, useContext } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { AnimatePresence, motion, useTransform, useScroll } from "framer-motion";
import * as THREE from "three";
import { Link } from "react-router-dom";
import CameraModel from "./CameraModel";
import Gallery from "./Gallery";
import Inquiry from "./Inquiry";
import Footer from "./Footer";
import FavoritesGallery from "./FavoritesGallery";
import { PARTS, beatFor, clamp01, samplePose, PLACEMENT } from "../data/cameraScript";
import { LenisContext } from "../lib/LenisContext";

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
function CameraRig({ 
  progress, 
  interactionMode 
}: { 
  progress: React.MutableRefObject<number>;
  interactionMode: "normal" | "zoomed-gallery" | "contact" | "menu";
}) {
  const { camera } = useThree();
  const advance = useThree((s) => s.advance);
  const cur = useRef(0);
  const curPos = useRef(new THREE.Vector3());
  const curTgt = useRef(new THREE.Vector3());

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

    // Determine the base scroll pose
    cur.current += (progress.current - cur.current) * (DEBUG ? 1 : Math.min(1, dt * 18));
    const scrollPose = samplePose(cur.current);

    const targetPos = new THREE.Vector3(scrollPose.pos[0], scrollPose.pos[1], scrollPose.pos[2]);
    const targetLook = new THREE.Vector3(scrollPose.target[0], scrollPose.target[1], scrollPose.target[2]);

    if (interactionMode === "zoomed-gallery") {
      const screenPos = PLACEMENT.lcdScreen.position; // [-0.14, 0.06, -0.94]
      const D = 0.72; // Zoom distance to screen
      targetPos.set(screenPos[0], screenPos[1], screenPos[2] - D);
      targetLook.set(screenPos[0], screenPos[1], screenPos[2]);
    }

    // Smoothly interpolate camera position and look-at target
    const easeFactor = Math.min(1, dt * 7.5);
    
    if (curPos.current.lengthSq() === 0) {
      curPos.current.copy(camera.position);
      curTgt.current.copy(targetLook);
    }

    curPos.current.lerp(targetPos, easeFactor);
    curTgt.current.lerp(targetLook, easeFactor);

    camera.position.copy(curPos.current);
    camera.lookAt(curTgt.current);
  });
  return null;
}

/* phase boundaries (p is local scroll progress through .camera-act; HUD frame
   number ≈ p * 1833.3): "hero" title fades out at frame 75 (p 0.04092), the
   "Pull back..." caption joins at frame 86 (p 0.04692) — leaving a brief,
   caption-free "pause" window — and hands off to beat 1's "PART 01 / 06
   VIEWFINDER" card exactly at frame 200 (p 0.10909, also beatFor's threshold)
   so the two captions never overlap. */
function phaseFor(p: number): "hero" | "pause" | "reveal" | "parts" | "thesis" | "favorites" | "exploded" {
  if (p < 0.04092) return "hero";
  if (p < 0.04692) return "pause";
  if (p < 0.10909) return "reveal";
  if (p < 0.70) return "parts";
  if (p < 0.75) return "thesis";
  if (p < 0.92) return "favorites";
  return "exploded";
}

export default function CameraExperience() {
  const section = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: section,
    offset: ["start start", "end end"],
  });
  const progress = useRef(0);
  const [beat, setBeat] = useState(0);
  const [phase, setPhase] = useState<ReturnType<typeof phaseFor>>("hero");
  const [interactionMode, setInteractionMode] = useState<"normal" | "zoomed-gallery" | "contact" | "menu">("normal");
  const [activeOverlay, setActiveOverlay] = useState<"none" | "favorites" | "footer">("none");
  const [shutterFlash, setShutterFlash] = useState(false);
  const lenis = useContext(LenisContext);

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

      // Determine active overlay from scroll progress
      setActiveOverlay((prev) => {
        let next: "none" | "favorites" | "footer" = "none";
        if (p >= 0.80 && p < 0.92) {
          next = "favorites";
        } else if (p >= 0.92) {
          next = "footer";
        }
        return prev === next ? prev : next;
      });
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

  // Lock Lenis and body scroll when in interactive overlays
  useEffect(() => {
    if (interactionMode !== "normal") {
      document.body.style.overflow = "hidden";
      lenis?.stop();
    } else {
      document.body.style.overflow = "";
      lenis?.start();
    }
    return () => {
      document.body.style.overflow = "";
      lenis?.start();
    };
  }, [interactionMode, lenis]);

  const part = beat >= 1 && beat <= 6 ? PARTS[beat - 1] : null;

  // High-DPR phone GPUs rendering WebGL at native 3x is the main mobile perf
  // killer — cap the upper bound to 1.5 on small screens (imperceptible, much
  // lighter). Desktop keeps the full 2x.
  const dprMax =
    typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 768 ? 1.5 : 2;

  // Synthesize a camera shutter click sound using Web Audio API (no heavy MP3 needed)
  const playShutterSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playClick = (time: number, freq: number, gainVal: number) => {
        const bufferSize = ctx.sampleRate * 0.05; // 50ms burst
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = freq;
        filter.Q.value = 3.0;
        
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(gainVal, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(time);
      };
      
      const now = ctx.currentTime;
      playClick(now, 1600, 0.4); // opening curtain (higher pitch)
      playClick(now + 0.08, 1200, 0.35); // closing curtain (lower pitch)
      
      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 300);
    } catch {
      // AudioContext fallback
    }
  };

  const handleShutterClick = () => {
    playShutterSound();
    setShutterFlash(true);
    setTimeout(() => {
      setInteractionMode("contact");
    }, 150);
  };

  const lcdOpacity = useTransform(scrollYProgress, [0.80, 0.82, 0.90, 0.92], [0, 1, 1, 0]);
  const lcdScale = useTransform(scrollYProgress, [0.80, 0.82, 0.90, 0.92], [0.95, 1, 1, 0.95]);

  const footerOpacity = useTransform(scrollYProgress, [0.92, 0.95], [0, 1]);
  const footerTranslateY = useTransform(scrollYProgress, [0.93, 1.00], ["0%", "-40%"]);

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
              <CameraRig progress={progress} interactionMode={interactionMode} />
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
              <CameraModel 
                progress={progress} 
                beat={beat} 
                photos={VIEWFINDER_CYCLE} 
                debug={DEBUG}
                interactionMode={interactionMode}
                showHotspots={false}
                onPlayClick={() => setInteractionMode("zoomed-gallery")}
                onMenuClick={() => setInteractionMode("menu")}
                onShutterClick={handleShutterClick}
              />
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
          <p className="long">
            A camera mimics the eye. The only difference —{" "}
            <span className="accent">the eye sees what the brain decides to notice</span>. A camera sees what you
            point it at.
          </p>
        </div>

        {/* ---------- per-part narration ---------- */}
        <AnimatePresence>
          {PARTS.map((p) => {
            const active = part?.no === p.no && interactionMode === "normal";
            return active ? (
              <motion.div
                key={p.no}
                className={`act-copy ${p.side}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <p className="eyebrow">PART {p.no} / 06</p>
                <h3>
                  {p.name}
                  <small>↳ {p.eye}</small>
                </h3>
                <p>{p.body}</p>
              </motion.div>
            ) : null;
          })}
        </AnimatePresence>

        {/* ---------- thesis ---------- */}
        <div
          className="act-thesis"
          style={{ 
            opacity: phase === "thesis" && interactionMode === "normal" ? 1 : 0, 
            transition: "opacity 1.0s ease-in-out",
            pointerEvents: "none" 
          }}
        >
          <p>
            One tool to freeze time in a single frame.
            <br />
            And these are some moments <span className="accent">I decided to freeze.</span>
          </p>
        </div>

        {/* ---------- scroll hint ---------- */}
        <div className="act-scroll-hint" style={{ opacity: phase === "hero" ? 1 : 0, transition: "opacity 0.5s" }}>
          <span className="dot" />
          scroll — the image is alive
        </div>

        {/* ---------- shutter flash animation ---------- */}
        <AnimatePresence>
          {shutterFlash && (
            <motion.div
              className="shutter-flash"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onAnimationComplete={() => setShutterFlash(false)}
            />
          )}
        </AnimatePresence>

        {/* ---------- gallery screen zoom overlay ---------- */}
        <AnimatePresence>
          {interactionMode === "zoomed-gallery" && (
            <motion.div
              className="gallery-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <button
                className="overlay-close-btn"
                onClick={(e) => { e.stopPropagation(); setInteractionMode("normal"); }}
                onPointerDown={(e) => { e.stopPropagation(); setInteractionMode("normal"); }}
              >
                ✕ Exit Screen
              </button>
              <div className="gallery-overlay-scrollable" data-lenis-prevent>
                <div className="gallery-overlay-content-wrapper" onClick={(e) => e.stopPropagation()}>
                  <Gallery />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---------- contact/shutter overlay ---------- */}
        <AnimatePresence>
          {interactionMode === "contact" && (
            <motion.div
              className="contact-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <button
                className="overlay-close-btn"
                onClick={(e) => { e.stopPropagation(); setInteractionMode("normal"); }}
                onPointerDown={(e) => { e.stopPropagation(); setInteractionMode("normal"); }}
              >
                ✕ Close Form
              </button>
              <div className="contact-overlay-scrollable" data-lenis-prevent>
                <div className="contact-overlay-content-wrapper" onClick={(e) => e.stopPropagation()}>
                  <Inquiry />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---------- menu overlay ---------- */}
        <AnimatePresence>
          {interactionMode === "menu" && (
            <motion.div
              className="menu-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setInteractionMode("normal");
                }
              }}
            >
              <motion.div
                className="menu-drawer-panel"
                data-lenis-prevent
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <button
                  className="overlay-close-btn"
                  onClick={(e) => { e.stopPropagation(); setInteractionMode("normal"); }}
                  onPointerDown={(e) => { e.stopPropagation(); setInteractionMode("normal"); }}
                >
                  ✕ Close Menu
                </button>
                <div className="menu-overlay-content">
                  <span className="menu-eyebrow">// Navigation</span>
                  <div className="menu-links-list">
                    <Link to="/work" className="menu-link-item" onClick={() => setInteractionMode("normal")}>
                      <span className="num">01</span>
                      <span className="text">Selected Work</span>
                      <span className="kicker">Night & light, land & layers</span>
                    </Link>
                    <Link to="/prints" className="menu-link-item" onClick={() => setInteractionMode("normal")}>
                      <span className="num">02</span>
                      <span className="text">Fine Art Prints</span>
                      <span className="kicker">Archival gallery prints</span>
                    </Link>
                    <Link to="/about" className="menu-link-item" onClick={() => setInteractionMode("normal")}>
                      <span className="num">03</span>
                      <span className="text">About Me</span>
                      <span className="kicker">Photographer × AI Engineer</span>
                    </Link>
                    <Link to="/services" className="menu-link-item" onClick={() => setInteractionMode("normal")}>
                      <span className="num">04</span>
                      <span className="text">Services</span>
                      <span className="kicker">Creative development & commissions</span>
                    </Link>
                    <a 
                      href="#contact" 
                      className="menu-link-item" 
                      onClick={(e) => { 
                        e.preventDefault(); 
                        setInteractionMode("contact"); 
                      }}
                    >
                      <span className="num">05</span>
                      <span className="text">Work With Me</span>
                      <span className="kicker">Drop an inquiry brief</span>
                    </a>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---------- scroll-linked favorites zoom overlay ---------- */}
        <motion.div
          className="lcd-zoom-overlay"
          style={{
            opacity: lcdOpacity,
            scale: lcdScale,
            pointerEvents: activeOverlay === "favorites" ? "auto" : "none",
          }}
        >
          <FavoritesGallery scrollYProgress={scrollYProgress} />
        </motion.div>

        {/* ---------- footer/contact exploded view overlay ---------- */}
        <motion.div
          className="exploded-footer-overlay"
          style={{
            opacity: footerOpacity,
            pointerEvents: activeOverlay === "footer" ? "auto" : "none",
          }}
        >
          <motion.div
            className="exploded-footer-content"
            style={{ y: footerTranslateY }}
          >
            <Footer />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
