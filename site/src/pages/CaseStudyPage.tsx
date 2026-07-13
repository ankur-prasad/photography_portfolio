import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import Footer from "../components/Footer";
import { usePageTitle } from "../lib/usePageTitle";

const EASE = [0.16, 1, 0.3, 1] as const;

const rise = {
  initial: { opacity: 0, y: 26 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-8% 0px" },
  transition: { duration: 0.8, ease: EASE },
} as const;

/** Case study: perfectworld.global — the one shipped client build, told the
 *  way a buyer evaluates: brief → build → stack → live link. */
export default function CaseStudyPage() {
  usePageTitle(
    "Case Study: Perfect World — Ankur Prasad",
    "A charity merch brand with an interactive 3D globe as its storefront — designed and engineered from scratch in React and Three.js."
  );
  return (
    <main className="page case">
      <section className="case-hero">
        <div className="container">
          <p className="eyebrow">// CASE STUDY — CLIENT BUILD</p>
          <motion.h1 {...rise}>Perfect World</motion.h1>
          <motion.p className="case-tagline" {...rise}>
            &ldquo;Together. Not alone.&rdquo; — a sustainable merch brand where 100% of
            profits go to charitable causes. The brand needed a store that felt like the
            mission, not like a template shop.
          </motion.p>
          <motion.a
            className="case-live"
            href="https://perfectworld.global"
            target="_blank"
            rel="noreferrer"
            data-cursor="view"
            {...rise}
          >
            perfectworld.global — live ↗
          </motion.a>
        </div>
      </section>

      <section className="case-shots">
        <div className="container">
          <motion.figure className="case-shot wide" {...rise}>
            <img src="/case/perfectworld-desktop.webp" alt="Perfect World homepage — an interactive 3D globe with the collections pinned to the places they support." loading="lazy" />
            <figcaption>The storefront is a planet. Each collection is pinned to the place its cause protects — spin the globe, tap a pin, shop the cause.</figcaption>
          </motion.figure>
          <div className="case-shot-row">
            <motion.figure className="case-shot" {...rise}>
              <img src="/case/perfectworld-desktop-2.webp" alt="Perfect World collections carousel with organic apparel." loading="lazy" />
              <figcaption>Collections carousel — organic tees, hoodies and totes per cause.</figcaption>
            </motion.figure>
            <motion.figure className="case-shot narrow" {...rise}>
              <img src="/case/perfectworld-mobile.webp" alt="Perfect World mobile homepage with the 3D globe." loading="lazy" />
              <figcaption>The full 3D experience holds up on a phone.</figcaption>
            </motion.figure>
          </div>
        </div>
      </section>

      <section className="case-body">
        <div className="container">
          <div className="case-cols">
            <motion.div {...rise}>
              <h2>The brief</h2>
              <p>
                A charity streetwear brand launching its first collections. Every euro of
                profit goes to ocean, climate, wildlife and mental-health projects — so the
                site had to carry that story instantly, build trust with first-time
                visitors, and still convert like a shop.
              </p>
            </motion.div>
            <motion.div {...rise}>
              <h2>The build</h2>
              <p>
                An interactive 3D globe as the storefront: collections pinned to the parts
                of the world their causes protect. Full e-commerce flow, launch campaign
                support, newsletter capture and analytics — designed and engineered from
                scratch, no theme, no page builder.
              </p>
            </motion.div>
            <motion.div {...rise}>
              <h2>The stack</h2>
              <p>
                React · Three.js · Vite — the same stack as the site you&apos;re on right
                now. Custom 3D, performance-tuned assets, responsive from ultrawide down to
                a phone in one hand.
              </p>
            </motion.div>
          </div>

          <motion.div className="case-cta" {...rise}>
            <p>Want a storefront or brand site that feels like this?</p>
            <Link to="/contact" className="services-cta-btn" data-cursor="email">
              Start a project →
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
