import { useEffect, useRef, useState } from "react";

function clamp01(x: number) {
  return Math.min(1, Math.max(0, x));
}

/** Label for the camera act, keyed off the act's own scroll progress. */
function camLabel(p: number) {
  if (p < 0.10909) return "001 — SIGNAL";
  if (p < 0.70) return "002 — THE APPARATUS";
  if (p < 0.75) return "003 — THE EYE";
  return "004 — RECOMPOSE";
}

/** Fixed cinematic HUD chrome. Frame counter + scrubber track the whole page;
 *  the section label tracks the camera act, then the gallery / contact. */
export default function Hud() {
  const playhead = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLSpanElement>(null);
  const [label, setLabel] = useState("001 — SIGNAL");

  useEffect(() => {
    let raf = 0;
    let queued = false;
    const update = () => {
      queued = false;
      const vh = window.innerHeight;
      const max = document.documentElement.scrollHeight - vh;
      const p = max > 0 ? clamp01(window.scrollY / max) : 0;
      if (playhead.current) playhead.current.style.left = `${p * 100}%`;
      if (frame.current) {
        frame.current.textContent = String(Math.round(p * 9999)).padStart(4, "0");
      }

      let lbl = "005 — THE WORK";
      const cam = document.querySelector(".camera-act") as HTMLElement | null;
      const contact = document.querySelector(".contact") as HTMLElement | null;
      if (cam) {
        const camTotal = cam.offsetHeight - vh;
        const camP = camTotal > 0 ? clamp01(-cam.getBoundingClientRect().top / camTotal) : 0;
        if (camP < 1) lbl = camLabel(camP);
      }
      if (contact && contact.getBoundingClientRect().top < vh * 0.6) lbl = "006 — WORK WITH ME";
      setLabel((prev) => (prev === lbl ? prev : lbl));
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="hud" aria-hidden>
      <span className="hud-bracket tl" />
      <span className="hud-bracket tr" />
      <span className="hud-bracket bl" />
      <span className="hud-bracket br" />

      <div className="hud-reticle">
        <span className="a" />
        <span className="b" />
        <span className="c" />
        <span className="d" />
      </div>

      <div className="hud-section">{label}</div>
      <div className="hud-frame">
        FRAME <span ref={frame}>0000</span>
      </div>

      <div className="hud-scrubber">
        <div className="hud-scrub-track">
          {Array.from({ length: 21 }).map((_, i) => (
            <i key={i} style={{ left: `${(i / 20) * 100}%` }} />
          ))}
        </div>
        <div className="hud-playhead" ref={playhead} style={{ left: "0%" }} />
      </div>
    </div>
  );
}
