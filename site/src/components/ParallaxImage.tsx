import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

interface ParallaxImageProps {
  src: string;
  alt?: string;
  /** Parallax intensity in percent — how far the image shifts (default 15) */
  intensity?: number;
  /** Border radius in px (default 4) */
  radius?: number;
  /** Optional fixed height (otherwise fills parent) */
  height?: number | string;
  /** Optional className */
  className?: string;
  onClick?: () => void;
}

/**
 * A scroll-driven parallax image inspired by Framer's TrueParallaxImage.
 *
 * The container clips its overflow; the inner `<img>` is taller by 2×intensity%
 * and shifts vertically as the container scrolls through the viewport, creating
 * a smooth parallax depth effect.
 */
export default function ParallaxImage({
  src,
  alt = "",
  intensity = 15,
  radius = 4,
  height,
  className = "",
  onClick,
}: ParallaxImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const y = useTransform(
    scrollYProgress,
    [0, 1],
    [`-${intensity}%`, `${intensity}%`]
  );

  return (
    <div
      ref={containerRef}
      className={`parallax-image ${className}`}
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: radius,
        height: height ?? "100%",
        cursor: onClick ? "pointer" : undefined,
      }}
      onClick={onClick}
      data-cursor={onClick ? "view" : undefined}
    >
      <motion.div
        style={{
          width: "100%",
          height: "100%",
          y,
          position: "absolute",
          top: 0,
          left: 0,
          willChange: "transform",
        }}
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          style={{
            position: "absolute",
            top: `-${intensity}%`,
            left: 0,
            width: "100%",
            height: `${100 + intensity * 2}%`,
            objectFit: "cover",
            display: "block",
          }}
        />
      </motion.div>
    </div>
  );
}
