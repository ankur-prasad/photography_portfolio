import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePageTitle } from "../lib/usePageTitle";
import { meta as META } from "../data/photos";
import Photo from "../components/Photo";
import Lightbox from "../components/Lightbox";
import PrintWaitlist from "../components/PrintWaitlist";
import Footer from "../components/Footer";

const EASE = [0.16, 1, 0.3, 1] as const;

// A curated print selection across the pillars.
const PICKS = [
  "/web/20160503_164015.jpg", "/web/ANK09879.jpg", "/web/ANK01938.jpg", "/web/ANK09500.jpg",
  "/web/ANK09501.jpg", "/web/ANK09564-Pano.jpg", "/web/ANK00164.jpg", "/web/ANK00158.jpg",
  "/web/ANK01923.jpg", "/web/ANK03670.jpg", "/web/ANK08834.jpg", "/web/ANK08837.jpg",
  "/web/ANK09212.jpg", "/web/ANK00285.jpg", "/web/ANK02676.jpg", "/web/ANK03010.jpg",
  "/web/ANK03580.jpg", "/web/ANK03352.jpg",
];

const INCLUDES: { k: string; v: string }[] = [
  { k: "Paper", v: "Archival fine-art cotton rag, pigment inks rated 100+ years" },
  { k: "Editions", v: "Limited and numbered — each size capped, then retired" },
  { k: "Signed", v: "Signed and numbered by hand on the reverse" },
  { k: "Sizes", v: "A3 · A2 · A1, framed or unframed" },
  { k: "Shipping", v: "Rolled in a rigid tube, worldwide" },
];

export default function PrintsPage() {
  usePageTitle(
    "Prints — Ankur Prasad",
    "Limited-edition archival prints by Ankur Prasad — signed, numbered, shipped worldwide. Join the waitlist for first access."
  );
  const [open, setOpen] = useState<string | null>(null);

  return (
    <main className="page prints">
      <section className="prints-hero">
        <div className="container">
          <motion.p className="eyebrow" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE }}>
            // Prints
          </motion.p>
          <motion.h1 className="prints-title" initial={{ opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE }}>
            Take one home.
          </motion.h1>
          <motion.p className="prints-lede" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.1, ease: EASE }}>
            A frame you keep returning to, printed the way it deserves — archival, limited, and
            signed. The print shop opens soon. Join the list for first access and founder pricing.
          </motion.p>

          <div className="prints-cta">
            <PrintWaitlist />
            <dl className="prints-includes">
              {INCLUDES.map((it) => (
                <div key={it.k}>
                  <dt>{it.k}</dt>
                  <dd>{it.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="prints-grid-sec">
        <div className="container">
          <p className="eyebrow">// The collection</p>
          <div className="print-grid">
            {PICKS.map((src) => {
              const m = META[src] ?? {};
              return (
                <figure key={src} className="print-card" data-cursor="view" onClick={() => setOpen(src)}>
                  <Photo src={src} alt={m.title || "Print"} loading="lazy" />
                  <figcaption>
                    <span className="print-card-title">{m.title}</span>
                    {m.location && <span className="print-card-loc">{m.location}</span>}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </div>
      </section>

      <Footer />

      <AnimatePresence>
        {open && <Lightbox src={open} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </main>
  );
}
