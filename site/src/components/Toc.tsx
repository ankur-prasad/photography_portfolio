import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { LenisContext } from "../lib/LenisContext";

/* Table-of-contents overlay — the "skip ramp" for visitors who won't scroll a
 * 760vh film to reach the work. Numbered like the HUD's act labels; jumps are
 * driven through Lenis so they inherit the site's easing. Home-only (the acts
 * are positions inside the camera act). */

const EASE = [0.16, 1, 0.3, 1] as const;

type Act = {
  no: string;
  title: string;
  hint: string;
  /** local progress through .camera-act; -1 → page bottom */
  p: number;
};

const ACTS: Act[] = [
  { no: "001", title: "Signal", hint: "the opening frame", p: 0 },
  { no: "002", title: "The Apparatus", hint: "a camera, part by part", p: 0.12 },
  { no: "003", title: "The Eye", hint: "what a camera mimics", p: 0.705 },
  { no: "004", title: "Recompose", hint: "moments, frozen", p: 0.755 },
  { no: "005", title: "The Work", hint: "the favorites", p: 0.8 },
  { no: "006", title: "Work With Me", hint: "commissions & builds", p: -1 },
];

export default function Toc() {
  const lenis = useContext(LenisContext);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    // freeze the scroll behind the overlay so a stray wheel doesn't move the film
    lenis?.stop();
    return () => {
      window.removeEventListener("keydown", onKey);
      lenis?.start();
    };
  }, [open, lenis]);

  const jump = (act: Act) => {
    let y = 0;
    if (act.p === -1) {
      y = document.documentElement.scrollHeight;
    } else {
      const cam = document.querySelector<HTMLElement>(".camera-act");
      if (cam) {
        const top = cam.getBoundingClientRect().top + window.scrollY;
        y = top + (cam.offsetHeight - window.innerHeight) * act.p;
      }
    }
    setOpen(false);
    if (lenis) {
      // restart before scrolling — a stopped Lenis swallows scrollTo
      lenis.start();
      lenis.scrollTo(y, { duration: 1.4 });
    } else {
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  return (
    <>
      <button className="toc-trigger" onClick={() => setOpen(true)} aria-label="Open index" data-cursor="view">
        <span className="toc-trigger-lines" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        INDEX
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="toc-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
          >
            <button className="toc-close" onClick={() => setOpen(false)} aria-label="Close index" data-cursor="close">
              ✕
            </button>
            <div className="toc-inner">
              <p className="toc-eyebrow">// INDEX — SKIP TO ANY FRAME</p>
              <ol className="toc-list">
                {ACTS.map((act, i) => (
                  <motion.li
                    key={act.no}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.06 * i, ease: EASE }}
                  >
                    <button className="toc-item" onClick={() => jump(act)} data-cursor="view">
                      <span className="toc-no">{act.no}</span>
                      <span className="toc-title">{act.title}</span>
                      <span className="toc-hint">{act.hint}</span>
                    </button>
                  </motion.li>
                ))}
              </ol>
              <motion.div
                className="toc-pages"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.45 }}
              >
                <span>PAGES</span>
                <Link to="/work" onClick={() => setOpen(false)}>Work</Link>
                <Link to="/prints" onClick={() => setOpen(false)}>Prints</Link>
                <Link to="/services" onClick={() => setOpen(false)}>Services</Link>
                <Link to="/about" onClick={() => setOpen(false)}>About</Link>
                <Link to="/contact" onClick={() => setOpen(false)} className="accent">Work with me →</Link>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
