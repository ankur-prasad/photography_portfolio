import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import ParallaxImage from "./ParallaxImage";
import Lightbox from "./Lightbox";

interface MasonryItem {
  src: string;
  alt?: string;
  /** Approximate height weight — drives the masonry layout balance */
  height?: number;
}

interface MasonryGridProps {
  items: MasonryItem[];
  /** Number of columns (responsive default: auto) */
  columns?: number;
  /** Gap between items in px */
  gap?: number;
  /** Parallax intensity for each image */
  parallaxIntensity?: number;
  /** Border radius on image cards */
  cardRadius?: number;
  /** Whether clicking opens a lightbox */
  lightbox?: boolean;
}

/**
 * Responsive masonry grid inspired by Framer's MasonryGrid.
 *
 * Distributes items across columns using a shortest-column-first algorithm,
 * rendering each item as a ParallaxImage with scroll-linked parallax.
 */
export default function MasonryGrid({
  items,
  columns = 3,
  gap = 8,
  parallaxIntensity = 12,
  cardRadius = 4,
  lightbox = true,
}: MasonryGridProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Distribute items across columns using shortest-column-first
  const columnArrays = useMemo(() => {
    const cols: MasonryItem[][] = Array.from({ length: columns }, () => []);
    const heights = Array(columns).fill(0);

    items.forEach((item) => {
      const shortestIdx = heights.indexOf(Math.min(...heights));
      cols[shortestIdx].push(item);
      heights[shortestIdx] += item.height ?? 300;
    });

    return cols;
  }, [items, columns]);

  return (
    <>
      <div
        className="masonry-grid"
        style={{
          display: "flex",
          gap,
          alignItems: "flex-start",
          width: "100%",
        }}
      >
        {columnArrays.map((column, colIdx) => (
          <div
            key={colIdx}
            className="masonry-grid__column"
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap,
            }}
          >
            {column.map((item, itemIdx) => (
              <ParallaxImage
                key={`${colIdx}-${itemIdx}`}
                src={item.src}
                alt={item.alt ?? ""}
                intensity={parallaxIntensity}
                radius={cardRadius}
                height={item.height ?? 300}
                onClick={lightbox ? () => setLightboxSrc(item.src) : undefined}
              />
            ))}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {lightboxSrc && (
          <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
        )}
      </AnimatePresence>
    </>
  );
}
