import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Footer from "../components/Footer";
import { usePageTitle } from "../lib/usePageTitle";

const EASE = [0.16, 1, 0.3, 1] as const;

/* Kompakte deutsche Landingpage — Ziel der Offline-Akquise (Briefe,
 * Vorbeischauen, QR-Codes). Führt in den englischen Hauptauftritt. */

const ANGEBOTE = [
  {
    no: "01",
    name: "Fotografie",
    desc: "Food-, Event- und Architekturfotografie in München und Umgebung. Geplant, fotografiert, fertig bearbeitet geliefert — inklusive Nutzungslizenz.",
    hint: "Halbtags · ganztags · mehrtägig",
  },
  {
    no: "02",
    name: "Web Experiences",
    desc: "Portfolio- und Markenseiten wie diese hier: flüssig, cinematisch, von Hand gebaut mit React und WebGL. Keine Templates, keine Baukästen.",
    hint: "Projekt mit festem Umfang",
  },
  {
    no: "03",
    name: "AI Consulting",
    desc: "Hauptberuflich bin ich AI Engineer. Strategie, Prototypen und produktive Systeme — wo KI wirklich passt, ohne den Hype.",
    hint: "Beratung · Projekt · Retainer",
  },
];

export default function GermanPage() {
  usePageTitle(
    "Ankur Prasad — Fotograf × AI Engineer, München",
    "Food-, Event- und Architekturfotografie in München. Maßgeschneiderte Websites mit React & WebGL. Anfragen werden innerhalb von 24 Stunden beantwortet."
  );
  return (
    <main className="page de-page">
      <section className="de-hero">
        <div className="container">
          <p className="eyebrow">// FOTOGRAF × AI ENGINEER — MÜNCHEN</p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            Ich sehe, was das Auge übersehen würde.
          </motion.h1>
          <motion.p
            className="de-hero-sub"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1, ease: EASE }}
          >
            Hallo — ich bin Ankur. Fotograf und AI Engineer in München. Ich fotografiere
            Restaurants, Events und Architektur — und baue Websites, die sich anfühlen wie
            diese hier. Alles aus einer Hand, alles selbst gemacht.
          </motion.p>
          <motion.div
            className="de-hero-links"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.25 }}
          >
            <Link to="/work" data-cursor="view">Arbeiten ansehen →</Link>
            <Link to="/contact" className="accent" data-cursor="email">Projekt anfragen →</Link>
          </motion.div>
        </div>
      </section>

      <section className="de-offers">
        <div className="container">
          <p className="eyebrow">// DREI ANGEBOTE</p>
          <div className="offer-grid">
            {ANGEBOTE.map((a, i) => (
              <motion.article
                className="offer"
                key={a.no}
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-8% 0px" }}
                transition={{ duration: 0.8, delay: i * 0.08, ease: EASE }}
              >
                <span className="offer-no">{a.no}</span>
                <h3 className="offer-name">{a.name}</h3>
                <p className="offer-desc">{a.desc}</p>
                <span className="offer-engagement">{a.hint}</span>
              </motion.article>
            ))}
          </div>
          <p className="de-note">
            Anfragen beantworte ich innerhalb von 24 Stunden — auf Deutsch oder Englisch.
            Das Portfolio ist auf Englisch; die Bilder sprechen für sich.
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
