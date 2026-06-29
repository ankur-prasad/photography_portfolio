import { motion } from "framer-motion";
import { galleries } from "../data/photos";
import IntroMeta from "./IntroMeta";

type Token =
  | { t: "w"; v: string; accent?: boolean }
  | { t: "img"; src: string };

// inline decorative frames — serve webp directly (universally supported)
const toWebp = (s: string) => s.replace(/\.jpe?g$/i, ".webp");
const IMG_A = toWebp(galleries["long"]?.[0] ?? "");
const IMG_B = toWebp(galleries["dark"]?.[0] ?? "");

// statement with two inline images embedded between the words (Tom Carder style)
const TOKENS: Token[] = [
  ..."Ten years, four continents,".split(" ").map((v) => ({ t: "w", v }) as Token),
  { t: "img", src: IMG_A },
  ..."one obsession:".split(" ").map((v) => ({ t: "w", v }) as Token),
  { t: "w", v: "light.", accent: true },
  { t: "img", src: IMG_B },
  ..."I shoot it, then I engineer new ways for you to feel it.".split(" ").map(
    (v) => ({ t: "w", v }) as Token
  ),
];

export default function Intro() {
  return (
    <section className="intro">
      <div className="container">
        <p className="intro-statement">
          {TOKENS.map((tok, i) =>
            tok.t === "img" ? (
              <motion.img
                key={i}
                className="intro-inline"
                src={tok.src}
                alt=""
                initial={{ opacity: 0, scale: 0.6, clipPath: "inset(0 100% 0 0)" }}
                whileInView={{ opacity: 1, scale: 1, clipPath: "inset(0 0% 0 0)" }}
                viewport={{ once: true, margin: "-20% 0px -20% 0px" }}
                transition={{ duration: 0.7, delay: i * 0.035, ease: [0.16, 1, 0.3, 1] }}
              />
            ) : (
              <motion.span
                key={i}
                style={{ display: "inline-block", marginRight: "0.28em" }}
                initial={{ opacity: 0.08 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, margin: "-25% 0px -25% 0px" }}
                transition={{ duration: 0.5, delay: i * 0.035 }}
                className={tok.accent ? "accent" : undefined}
              >
                {tok.v}
              </motion.span>
            )
          )}
        </p>
        <IntroMeta />
      </div>
    </section>
  );
}
