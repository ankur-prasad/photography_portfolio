import { useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { usePageTitle } from "../lib/usePageTitle";
import { usePhotos } from "../lib/usePhotos";
import Photo from "../components/Photo";
import PrintShop from "../components/PrintShop";
import BooksTeaser from "../components/BooksTeaser";
import PrintWaitlist from "../components/PrintWaitlist";
import Footer from "../components/Footer";

const EASE = [0.16, 1, 0.3, 1] as const;

// The curated print selection across the pillars.
const PICKS = [
  "/web/20160503_164015.jpg", "/web/ANK09879.jpg", "/web/ANK01938.jpg", "/web/ANK09500.jpg",
  "/web/ANK09501.jpg", "/web/ANK09564-Pano.jpg", "/web/ANK00164.jpg", "/web/ANK00158.jpg",
  "/web/ANK01923.jpg", "/web/ANK03670.jpg", "/web/ANK08834.jpg", "/web/ANK08837.jpg",
  "/web/ANK09212.jpg", "/web/ANK00285.jpg", "/web/ANK02676.jpg", "/web/ANK03010.jpg",
  "/web/ANK03580.jpg", "/web/ANK03352.jpg",
];

const INCLUDES: { k: string; v: string }[] = [
  { k: "Paper", v: "Hahnemühle Photo Rag — museum-grade cotton, pigment inks rated 100+ years" },
  { k: "Editions", v: "Limited and numbered — each size capped, then retired" },
  { k: "Signed", v: "Signed and numbered by hand on the reverse" },
  { k: "Finishes", v: "Box framed, float-framed canvas, canvas, acrylic, metal (Dibond) or print only" },
  { k: "Fitted sizes", v: "Sizes are offered per photo — the full frame survives, panoramas included" },
  { k: "Shipping", v: "Framed ready-to-hang or rolled in a rigid tube, worldwide" },
];

export default function PrintsPage() {
  usePageTitle(
    "Prints — Ankur Prasad",
    "Limited-edition archival prints by Ankur Prasad — see them on your wall at true scale. Framed, canvas or print only, shipped worldwide."
  );
  const [params] = useSearchParams();
  // ?photo=<stem> deep link (from the lightbox) — any photo is printable, even
  // ones outside the curated PICKS; those just join the strip up front.
  const q = params.get("photo");
  const fromParam = q ? PICKS.find((p) => p.includes(q)) ?? `/web/${q}.jpg` : null;
  const [selected, setSelected] = useState<string>(fromParam ?? PICKS[0]);
  const picks = PICKS.includes(selected) ? PICKS : [selected, ...PICKS];
  const META = usePhotos()?.meta ?? {};

  const pick = (src: string) => {
    setSelected(src);
    document.getElementById("configure")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
            A frame you keep returning to, printed the way it deserves — archival, limited and
            signed. Pick one below and see it on your wall, at true scale.
          </motion.p>
        </div>
      </section>

      <PrintShop picks={picks} selected={selected} onSelect={setSelected} />

      <section className="prints-meta-sec">
        <div className="container">
          <div className="prints-cta">
            <div>
              <p className="eyebrow">// First access</p>
              <p className="prints-waitlist-lede">
                Direct checkout is coming online. Join the list — launch gets founder pricing.
              </p>
              <PrintWaitlist />
            </div>
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

      <BooksTeaser />

      <section className="prints-grid-sec">
        <div className="container">
          <p className="eyebrow">// The collection</p>
          <div className="print-grid">
            {PICKS.map((src) => {
              const m = META[src] ?? {};
              return (
                <figure key={src} className="print-card" data-cursor="view" onClick={() => pick(src)}>
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
    </main>
  );
}
