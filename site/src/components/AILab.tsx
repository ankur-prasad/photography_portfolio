import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import DepthScene from "./DepthScene";
import { heroes } from "../data/photos";
import { heroSource } from "../lib/media";

const ANNOS = [
  { n: "01", label: "Neural depth map", x: 17, y: 34, side: "right" },
  { n: "02", label: "Background // −Z", x: 80, y: 24, side: "left" },
  { n: "03", label: "Foreground // +Z parallax", x: 46, y: 82, side: "right" },
];

const LABELS: Record<string, string> = {
  "0961": "White Sands, New Mexico",
  "1146": "Gran Canaria ridgelines",
  "1268": "Königssee, Bavaria",
  "0798": "Horseshoe Bend, Arizona",
  "0762": "Grand Canyon at dawn",
  "0517": "One World Trade, NYC",
  "0648": "The Oculus, NYC",
  "0080": "Autobahn light trails",
  "0603": "Manhattan after dark",
  "1461": "Jaguar E-Type, Walchensee",
  "1432": "E-Type through the curves",
  "0339": "Frozen lake, Netherlands",
};

export default function AILab() {
  const [active, setActive] = useState(
    heroes.find((h) => h.id === "1146") ?? heroes[0]
  );
  const [immersive, setImmersive] = useState(false);

  return (
    <section className="lab" id="lab">
      <div className="container">
        <motion.div
          className="lab-head"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="lab-title">
            AI Photo <span className="accent">Lab</span>
          </h2>
          <p className="lab-sub">
            Every photograph hides a third dimension. I recover it with neural
            depth estimation, then rebuild the scene so it responds to you.
            Move through the frame below — then step inside it.
          </p>
        </motion.div>

        <motion.div
          className="lab-stage"
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="lab-stage-canvas">
            <DepthScene
              key={active.id}
              photo={heroSource(active)}
              depth={active.depth}
              strength={0.075}
              zoom={1.06}
            />
          </div>
          <div className="lab-annotations" aria-hidden>
            {ANNOS.map((a) => (
              <div
                key={a.n}
                className={`lab-anno ${a.side}`}
                style={{ left: `${a.x}%`, top: `${a.y}%` }}
              >
                <span className="lab-anno-dot" />
                <span className="lab-anno-arm">
                  <span className="lab-anno-line" />
                  <span className="lab-anno-label">
                    <b>{a.n}</b> {a.label}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <div className="lab-stage-ui">
            <span className="tag">{LABELS[active.id] ?? "Untitled"}</span>
            <span className="tag">Depth · Neural</span>
          </div>
          <button className="lab-enter" onClick={() => setImmersive(true)}>
            Enter this photo
          </button>
        </motion.div>

        <div className="lab-thumbs">
          {heroes.map((h) => (
            <button
              key={h.id}
              className={h.id === active.id ? "active" : ""}
              onClick={() => setActive(h)}
              aria-label={LABELS[h.id] ?? h.id}
            >
              <img src={h.web} loading="lazy" alt="" />
            </button>
          ))}
        </div>

        <p className="lab-note">
          Built with a monocular depth network (Depth Anything V2) and a custom
          WebGL parallax shader. The same pipeline can turn your photos — or
          your brand's — into living imagery.
        </p>
      </div>

      <AnimatePresence>
        {immersive && (
          <motion.div
            className="immersive"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <DepthScene
              photo={heroSource(active)}
              depth={active.depth}
              strength={0.14}
              zoom={1.22}
            />
            <button
              className="immersive-close"
              onClick={() => setImmersive(false)}
            >
              Exit
            </button>
            <span className="immersive-hint">
              Move to look around — {LABELS[active.id] ?? ""}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
