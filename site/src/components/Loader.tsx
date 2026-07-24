import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STAGES = ["calibrating lens", "reading light", "focusing", "ready"];

/**
 * Intro loading screen — a focus pull. The wordmark starts soft and racks
 * into focus as the counter climbs, viewfinder brackets + a center reticle
 * (echoing the Hud) tighten in sync, then a shutter flash and an iris wipe
 * hand off to the page. Kept short and non-blocking.
 */
export default function Loader({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const [flash, setFlash] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const start = performance.now();
    const DURATION = 2200;
    let raf = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      // ease-out so it decelerates into 100
      const eased = 1 - Math.pow(1 - t, 2.4);
      setPct(Math.round(eased * 100));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setFlash(true);
        setTimeout(() => setFlash(false), 340);
        setTimeout(() => setDone(true), 420);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const stage = STAGES[Math.min(STAGES.length - 1, Math.floor((pct / 100) * STAGES.length))];
  const focus = pct / 100; // 0 = wide open / soft focus, 1 = locked on

  return (
    <AnimatePresence onExitComplete={onDone}>
      {!done && (
        <motion.div
          className="loader"
          initial={{ clipPath: "circle(150% at 50% 50%)" }}
          exit={{ clipPath: "circle(0% at 50% 50%)" }}
          transition={{ duration: 0.9, ease: [0.76, 0, 0.24, 1] }}
        >
          <div className="loader-brackets" style={{ opacity: Math.min(1, focus * 1.6) }}>
            <span
              className="loader-bracket tl"
              style={{ transform: `translate(${(1 - focus) * -10}px, ${(1 - focus) * -10}px)` }}
            />
            <span
              className="loader-bracket tr"
              style={{ transform: `translate(${(1 - focus) * 10}px, ${(1 - focus) * -10}px)` }}
            />
            <span
              className="loader-bracket bl"
              style={{ transform: `translate(${(1 - focus) * -10}px, ${(1 - focus) * 10}px)` }}
            />
            <span
              className="loader-bracket br"
              style={{ transform: `translate(${(1 - focus) * 10}px, ${(1 - focus) * 10}px)` }}
            />
          </div>

          <div
            className="loader-reticle"
            style={{
              opacity: 0.25 + focus * 0.5,
              transform: `translate(-50%, -50%) scale(${1.4 - focus * 0.4})`,
            }}
          >
            <span className="a" />
            <span className="b" />
            <span className="c" />
            <span className="d" />
          </div>

          <div className="loader-inner">
            <h1
              className="loader-mark"
              style={{
                filter: `blur(${(1 - focus) * 14}px)`,
                transform: `scale(${1 + (1 - focus) * 0.05})`,
              }}
            >
              <span className="line">
                <motion.span
                  style={{ display: "block" }}
                  initial={{ y: "110%" }}
                  animate={{ y: "0%" }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                >
                  Ankur
                </motion.span>
              </span>
              <span className="line">
                <motion.span
                  style={{ display: "block" }}
                  initial={{ y: "110%" }}
                  animate={{ y: "0%" }}
                  transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                >
                  Prasad
                </motion.span>
              </span>
            </h1>
            <motion.p
              className="loader-tag"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
            >
              Photography · Engineered
            </motion.p>
          </div>

          <div className="loader-status">
            loading <b>{stage}</b>
          </div>
          <div className="loader-count">
            {pct}
            <sup>%</sup>
          </div>
          <div className="loader-bar" style={{ width: `${pct}%` }} />

          <AnimatePresence>
            {flash && (
              <motion.div
                className="loader-flash"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.85 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.17, ease: "easeOut" }}
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
