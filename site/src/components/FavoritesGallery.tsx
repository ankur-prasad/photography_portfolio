import { motion, useTransform, MotionValue } from "framer-motion";
import MasonryGrid from "./MasonryGrid";

/*
 * 16 curated favorites drawn from across all pillars — uses the web-optimised
 * `/web/` paths. Heights are hand-tuned for a balanced masonry layout.
 */
const FAVORITES = [
  { src: "/web/ANK00641.jpg",           alt: "Surface — still water",        height: 380 },
  { src: "/web/ANK09879.jpg",           alt: "Mountain ridgeline at dusk",   height: 320 },
  { src: "/web/ANK08837.jpg",           alt: "Urban geometry at night",      height: 420 },
  { src: "/web/ANK01938.jpg",           alt: "Layered landscape",            height: 340 },
  { src: "/web/20160503_164015.jpg",    alt: "Drift — weightless glow",      height: 360 },
  { src: "/web/ANK03010.jpg",           alt: "Far horizon — travel",         height: 400 },
  { src: "/web/ANK09212.jpg",           alt: "Hard lines — architecture",    height: 350 },
  { src: "/web/ANK09500.jpg",           alt: "Canyon depth",                 height: 380 },
  { src: "/web/ANK02879.jpg",           alt: "The Eye — held still",         height: 300 },
  { src: "/web/ANK00325.jpg",           alt: "After dark — night sky",       height: 440 },
  { src: "/web/ANK03575.jpg",           alt: "Ruins — far afield",           height: 360 },
  { src: "/web/ANK09153.jpg",           alt: "City glass and grids",         height: 320 },
  { src: "/web/ANK07684.jpg",           alt: "At speed — machine blur",      height: 380 },
  { src: "/web/ANK03670.jpg",           alt: "Stars after dark",             height: 400 },
  { src: "/web/ANK00164.jpg",           alt: "Negative space — quiet frame", height: 340 },
  { src: "/web/ANK00014.jpg",           alt: "Motion held still",            height: 360 },
];

interface FavoritesGalleryProps {
  scrollYProgress: MotionValue<number>;
}

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * FavoritesGallery — a curated masonry grid of favorite photos,
 * shown inside the "LCD screen" after the camera zooms in.
 *
 * It scrolls up dynamically as scrollYProgress goes from 0.80 to 0.90.
 */
export default function FavoritesGallery({ scrollYProgress }: FavoritesGalleryProps) {
  // Responsive columns — detected via CSS media query fallback
  const cols =
    typeof window !== "undefined"
      ? window.innerWidth >= 1024
        ? 3
        : window.innerWidth >= 600
        ? 2
        : 1
      : 3;

  // Translate the gallery content container upward to simulate scroll
  const translateY = useTransform(
    scrollYProgress,
    [0.80, 0.90],
    ["0%", "-65%"]
  );

  return (
    <div className="favorites-gallery-scroll-wrapper">
      <motion.div
        className="favorites-gallery"
        style={{ y: translateY, willChange: "transform" }}
      >
        <div className="favorites-gallery__inner">
          <motion.div
            className="favorites-gallery__header"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10% 0px" }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            <p className="eyebrow">// My Favorites</p>
            <h2 className="favorites-gallery__title">
              Moments I keep
              <br />
              coming back to.
            </h2>
          </motion.div>

          <MasonryGrid
            items={FAVORITES}
            columns={cols}
            gap={6}
            parallaxIntensity={10}
            cardRadius={3}
            lightbox
          />
        </div>
      </motion.div>
    </div>
  );
}
