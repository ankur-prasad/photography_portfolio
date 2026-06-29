import { useState } from "react";
import { motion } from "framer-motion";
import { galleries } from "../data/photos";
import Photo from "./Photo";

export interface Pillar {
  key: string;
  no: string;
  title: string;
  blurb: string;
}

// 3 representative thumbs per pillar, kept pillar-contiguous so each pillar
// forms one segment of the arc.
function buildArc(pillars: Pillar[]) {
  return pillars.flatMap((p, pi) =>
    (galleries[p.key] ?? []).slice(0, 3).map((src, j) => ({ src, pi, key: `${p.key}-${j}` }))
  );
}

const SPREAD = 1.5; // total fan angle (radians)

export default function WorksIndex({
  pillars,
  onOpen,
}: {
  pillars: Pillar[];
  onOpen: (src: string) => void;
}) {
  const arc = buildArc(pillars);
  const [hover, setHover] = useState<number | null>(null);
  const n = arc.length;

  return (
    <div className="works-index">
      <ul className="wi-list">
        {pillars.map((p, pi) => (
          <li
            key={p.key}
            className={hover === pi ? "active" : ""}
            onMouseEnter={() => setHover(pi)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="wi-no">{p.no}</span>
            <span className="wi-title">{p.title}</span>
          </li>
        ))}
      </ul>

      <div className="wi-arc">
        {arc.map((item, k) => {
          const t = n > 1 ? k / (n - 1) - 0.5 : 0; // -0.5 .. 0.5
          const angle = t * SPREAD;
          const x = 50 + Math.sin(angle) * 42; // %
          const lift = (1 - Math.cos(angle)) * 16; // edges rise (smile)
          const dim = hover === null ? 1 : hover === item.pi ? 1 : 0.32;
          const raise = hover === item.pi ? 26 : 0;
          return (
            <div
              key={item.key}
              className="wi-slot"
              style={{
                left: `${x}%`,
                bottom: `${lift}%`,
                transform: `translateX(-50%) rotate(${angle}rad)`,
                zIndex: hover === item.pi ? 20 : 10 - Math.abs(Math.round(t * 10)),
              }}
            >
              <motion.figure
                className="wi-card"
                initial={false}
                animate={{ opacity: dim, y: -raise }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                onMouseEnter={() => setHover(item.pi)}
                onClick={() => onOpen(item.src)}
              >
                <Photo src={item.src} loading="lazy" alt="" />
              </motion.figure>
            </div>
          );
        })}
      </div>
    </div>
  );
}
