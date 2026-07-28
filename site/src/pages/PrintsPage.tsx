import { Suspense, lazy, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { usePageTitle } from "../lib/usePageTitle";
import { usePhotos } from "../lib/usePhotos";
import { canRenderHeavy3D } from "../lib/canRender3D";
import { usePrintConfig } from "../lib/usePrintConfig";
import Photo from "../components/Photo";
import PrintShop from "../components/PrintShop";
import PrintWaitlist from "../components/PrintWaitlist";
import Footer from "../components/Footer";

/* The 3D room pulls in three.js, so it stays out of this page's chunk for
   everyone who will not see it. */
const PrintsRoom = lazy(() => import("../components/PrintsRoom"));

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
  const orderSuccess = params.get("order") === "success";
  // ?photo=<stem> deep link (from the lightbox) — any photo is printable, even
  // ones outside the curated PICKS; those just join the strip up front.
  const q = params.get("photo");
  const fromParam = q ? PICKS.find((p) => p.includes(q)) ?? `/web/${q}.jpg` : null;
  const [selected, setSelected] = useState<string>(fromParam ?? PICKS[0]);
  const picks = PICKS.includes(selected) ? PICKS : [selected, ...PICKS];
  const META = usePhotos()?.meta ?? {};

  /* One config for whichever presentation renders, so the room walk and the flat
     configurator can never disagree about the SKU or the price. */
  const cfg = usePrintConfig(selected);

  /* Probe after mount: it touches window and makes a throwaway GL context.
     Failing closed means everyone gets the flat configurator until we know the
     machine can carry a room — this page takes orders, and the flat version is
     instant, accessible and to-scale. */
  const [room3d, setRoom3d] = useState(false);
  useEffect(() => setRoom3d(canRenderHeavy3D()), []);

  const pick = (src: string) => {
    setSelected(src);
    document.getElementById("configure")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const immersive = room3d && cfg.ready;

  return (
    <main className={immersive ? "page prints is-immersive" : "page prints"}>
      {orderSuccess && (
        <div className="order-success" role="status">
          <div className="container">
            <p>
              <strong>Order received — thank you.</strong> A confirmation is on its way to your
              inbox. I sign and number every print myself before it ships.
            </p>
          </div>
        </div>
      )}
      {immersive ? (
        /* The room is the backdrop and every option lives in one panel beside
           it. The hero copy moves into that panel's header. */
        <Suspense fallback={null}>
          <PrintsRoom cfg={cfg} picks={picks} selected={selected} onSelect={setSelected} />
        </Suspense>
      ) : (
        <>
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
        </>
      )}

      <section className="prints-meta-sec">
        <div className="container">
          <div className="prints-cta">
            <div>
              <p className="eyebrow">// First access</p>
              <p className="prints-waitlist-lede">
                Want first look at new frames as the archive grows? Join the list.
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
