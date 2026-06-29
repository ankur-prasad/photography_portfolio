import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { galleries, pillars as PILLARS } from "../data/photos";
import Photo from "./Photo";
import Lightbox from "./Lightbox";

export default function Gallery() {
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <section className="gallery" id="work">
      <div className="container">
        <div className="gallery-intro">
          <p className="eyebrow">// The Work</p>
          <h2>
            Six ways of looking. Every frame here passed through the apparatus you just took
            apart.
          </h2>
        </div>

        {PILLARS.map((p) => {
          const imgs = (galleries[p.key] ?? []).slice(0, 5);
          return (
            <div className="pillar" key={p.key}>
              <div className="pillar-head">
                <span className="pillar-no">{p.no}</span>
                <h3 className="pillar-title">{p.title}</h3>
                <p className="pillar-blurb">{p.blurb}</p>
              </div>
              <div className="pillar-grid">
                {imgs.map((src) => (
                  <figure key={src} data-cursor="view" onClick={() => setLightbox(src)}>
                    <Photo src={src} alt={`${p.title} — ${p.blurb} Photograph by Ankur Prasad.`} loading="lazy" />
                  </figure>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
      </AnimatePresence>
    </section>
  );
}
