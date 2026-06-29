import { useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { meta as META } from "../data/photos";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Rich lightbox: the frame + its title, location, capture settings, and CTAs.
 *  Shared by the home Gallery and the Work page. */
export default function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const m = META[src] ?? {};
  const webp = src.replace(/\.jpe?g$/i, ".webp");
  const exifLine = [m.year, m.camera, m.settings].filter(Boolean).join("  ·  ");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="lightbox"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClose}
      data-cursor="close"
    >
      <button className="lb-close" onClick={onClose} aria-label="Close" data-cursor="close">
        ✕
      </button>
      <motion.div
        className="lb-frame"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.97, opacity: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
      >
        <picture style={{ display: "contents" }}>
          <source srcSet={webp} type="image/webp" />
          <img className="lb-img" src={src} alt={m.title || ""} />
        </picture>

        <div className="lb-meta">
          <div className="lb-meta-main">
            {m.title && <h3 className="lb-title">{m.title}</h3>}
            {m.location && <p className="lb-loc">{m.location}</p>}
            {m.story && <p className="lb-story">{m.story}</p>}
          </div>
          <div className="lb-meta-side">
            {exifLine && <p className="lb-exif">{exifLine}</p>}
            {m.lens && <p className="lb-lens">{m.lens}</p>}
            <div className="lb-actions">
              {m.depthId && (
                <Link className="lb-link" to="/lab" onClick={onClose} data-cursor="view">
                  View in depth →
                </Link>
              )}
              {m.print && (
                <a className="lb-link accent" href="#contact" onClick={onClose} data-cursor="email">
                  Print available — inquire →
                </a>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
