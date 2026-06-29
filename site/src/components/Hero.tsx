import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import DepthScene from "./DepthScene";
import { heroes } from "../data/photos";

const heroShot = heroes.find((h) => h.id === "0961") ?? heroes[0];

const lineAnim = {
  hidden: { y: "110%" },
  show: (i: number) => ({
    y: "0%",
    transition: { duration: 1.1, delay: 0.15 + i * 0.12, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // cinematic scroll hand-off
  const canvasScale = useTransform(scrollYProgress, [0, 1], [1, 1.22]);
  const canvasY = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, -150]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);

  return (
    <header className="hero" id="top" ref={ref}>
      <motion.div className="hero-canvas" style={{ scale: canvasScale, y: canvasY }}>
        <DepthScene photo={heroShot.photo} depth={heroShot.depth} strength={0.05} />
      </motion.div>
      <div className="hero-veil" />
      <motion.div className="hero-copy" style={{ y: copyY, opacity: copyOpacity }}>
        <div className="container">
          <motion.p
            className="hero-kicker"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.9 }}
          >
            Photographer × AI Engineer — Munich
          </motion.p>
          <h1 className="hero-title" aria-label="Ankur Prasad">
            <span className="line">
              <motion.span
                style={{ display: "block" }}
                variants={lineAnim}
                custom={0}
                initial="hidden"
                animate="show"
              >
                Ankur
              </motion.span>
            </span>
            <span className="line">
              <motion.span
                style={{ display: "block" }}
                variants={lineAnim}
                custom={1}
                initial="hidden"
                animate="show"
              >
                Prasad
              </motion.span>
            </span>
          </h1>
          <motion.p
            className="hero-sub"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.7 }}
          >
            I make photographs you can step into — and build the technology
            that takes you there.
          </motion.p>
        </div>
      </motion.div>
      <motion.div
        className="hero-hint"
        style={{ opacity: copyOpacity }}
      >
        <motion.span
          className="hint-inner"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.4 }}
        >
          <span className="dot" />
          This image is alive — move your cursor
        </motion.span>
      </motion.div>
    </header>
  );
}
