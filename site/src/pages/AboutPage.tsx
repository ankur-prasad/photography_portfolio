import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import IntroMeta from "../components/IntroMeta";
import Footer from "../components/Footer";
import { usePageTitle } from "../lib/usePageTitle";

const EASE = [0.16, 1, 0.3, 1] as const;

function Eyebrow({ children }: { children: string }) {
  return <p className="eyebrow">{children}</p>;
}

export default function AboutPage() {
  usePageTitle(
    "About — Ankur Prasad",
    "Ankur Prasad — photographer and AI engineer in Munich. Heart first, then the head: ten years and 1,500 frames curated into one archive."
  );
  return (
    <main className="page about">
      <section className="about-hero">
        <div className="container">
          <Eyebrow>// About</Eyebrow>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            First the heart. Then the head.
          </motion.h1>
          <motion.p
            className="about-hero-sub"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.9, delay: 0.1, ease: EASE }}
          >
            Two instincts, one practice — the same eye, pointed at people and at pixels.
          </motion.p>
        </div>
      </section>

      <section className="about-heart">
        <div className="container">
          <Eyebrow>// Before the shot</Eyebrow>
          <motion.h2
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            Heart first.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.8, delay: 0.08, ease: EASE }}
          >
            Skill is five percent. Gear is five percent. The other ninety is being there —
            present, in the room, in the weather, in the moment before it happens.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.8, delay: 0.16, ease: EASE }}
          >
            I am there to feel what the room feels before it knows it. The smile that almost
            didn&apos;t happen. The breath held half a second too long. That&apos;s the frame —
            felt before it&apos;s seen.
          </motion.p>
          <motion.p
            className="about-bridge"
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.8, delay: 0.24, ease: EASE }}
          >
            Heart finds the moment. <span className="accent">Head has to catch it.</span>
          </motion.p>
        </div>
      </section>

      <section className="about-head">
        <div className="container">
          <Eyebrow>// Then the shot</Eyebrow>
          <motion.h2
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            Then the head.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.8, delay: 0.08, ease: EASE }}
          >
            Once the heart finds it, the head takes over — fast. Shutter speed, aperture, ISO.
            Focal length, position, the angle that makes the moment readable. Compose, then
            commit. A camera is an eye we learned to build —{" "}
            <Link className="about-link" to="/">
              I take it apart on the home page
            </Link>{" "}
            — and every part of it exists to serve the instant the heart already chose.
          </motion.p>
          <motion.p
            className="about-bridge"
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.8, delay: 0.16, ease: EASE }}
          >
            Ten years of that — heart, then head, on repeat — is the archive below.
          </motion.p>
          <IntroMeta />
        </div>
      </section>

      <section className="about-craft">
        <div className="container">
          <Eyebrow>// The same eye, twice</Eyebrow>
          <motion.h2
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            This site is the proof.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.8, delay: 0.08, ease: EASE }}
          >
            Framing a photograph and framing a page are the same decision, asked twice. Where the
            eye lands first. What gets cropped out so the rest can breathe. When to hold a beat —
            and when to cut.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.8, delay: 0.16, ease: EASE }}
          >
            Every scroll on this site, every transition, was composed the way I&apos;d compose a
            frame — then built the way I&apos;d build anything else technical: deliberately, from
            scratch. <Link className="about-link" to="/services">See the craft</Link>.
          </motion.p>

          <motion.dl
            className="colophon"
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
          >
            <div><dt>Built with</dt><dd>React 19 · TypeScript · Vite</dd></div>
            <div><dt>The camera</dt><dd>A photoscanned 35mm body you take apart in 3D — Three.js / WebGL</dd></div>
            <div><dt>The depth</dt><dd>Custom GLSL shaders + AI depth maps — photos you can step into</dd></div>
            <div><dt>Templates used</dt><dd>Zero. Every line written by hand.</dd></div>
          </motion.dl>
        </div>
      </section>

      <Footer />
    </main>
  );
}
