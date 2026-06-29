import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { galleries, pillars as PILLARS } from "../data/photos";
import WorksIndex from "./WorksIndex";
import Photo from "./Photo";
import Lightbox from "./Lightbox";

export default function Work() {
  const [open, setOpen] = useState<string | null>(null);
  const [view, setView] = useState<"grid" | "index">("grid");

  return (
    <section className="work" id="work">
      <div className="container">
        <div className="work-toggle">
          <span className="work-toggle-label">Selected work</span>
          <div className="work-toggle-btns">
            <button
              className={view === "grid" ? "active" : ""}
              onClick={() => setView("grid")}
            >
              // grid
            </button>
            <button
              className={view === "index" ? "active" : ""}
              onClick={() => setView("index")}
            >
              // index
            </button>
          </div>
        </div>

        {view === "index" && (
          <WorksIndex pillars={PILLARS} onOpen={(src) => setOpen(src)} />
        )}

        {view === "grid" &&
          PILLARS.map((p) => (
          <article className="pillar" key={p.key}>
            <motion.div
              className="pillar-head"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10% 0px" }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="pillar-no">{p.no}</span>
              <h2 className="pillar-title">{p.title}</h2>
              <p className="pillar-blurb">{p.blurb}</p>
            </motion.div>
            <div className="pillar-grid">
              {(galleries[p.key] ?? []).map((src, i) => (
                <motion.figure
                  key={src}
                  layoutId={src}
                  initial={{ opacity: 0, y: 44 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-6% 0px" }}
                  transition={{
                    duration: 0.9,
                    delay: (i % 3) * 0.08,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  onClick={() => setOpen(src)}
                >
                  <Photo src={src} loading="lazy" alt={`${p.title} — ${p.blurb} Photograph by Ankur Prasad.`} />
                </motion.figure>
              ))}
            </div>
          </article>
        ))}
      </div>

      <AnimatePresence>
        {open && <Lightbox src={open} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </section>
  );
}
