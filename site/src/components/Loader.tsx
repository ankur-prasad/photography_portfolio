import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const STAGES = ["calibrating lens", "reading light", "focusing", "ready"];

/**
 * Intro loading screen — a count-up + wordmark reveal that lifts away.
 * Recreated in the spirit of thomasmamfredas.com's intro, with our own
 * branding and copy. Kept short and non-blocking.
 */
export default function Loader({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
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
      if (t < 1) raf = requestAnimationFrame(tick);
      else setTimeout(() => setDone(true), 260);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const stage = STAGES[Math.min(STAGES.length - 1, Math.floor((pct / 100) * STAGES.length))];

  return (
    <AnimatePresence onExitComplete={onDone}>
      {!done && (
        <motion.div
          className="loader"
          initial={{ opacity: 1 }}
          exit={{ y: "-100%" }}
          transition={{ duration: 1.05, ease: [0.76, 0, 0.24, 1] }}
        >
          <div className="loader-inner">
            <h1 className="loader-mark">
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
