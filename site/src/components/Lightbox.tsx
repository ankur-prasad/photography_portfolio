import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { usePhotos } from "../lib/usePhotos";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Rich lightbox: the frame + its title, location, capture settings, and CTAs.
 *  Shared by Gallery, Work, MasonryGrid and Prints. Pass `srcs` + `onNavigate`
 *  to enable prev/next (arrow keys + on-screen chevrons). */
export default function Lightbox({
  src,
  onClose,
  srcs,
  onNavigate,
}: {
  src: string;
  onClose: () => void;
  srcs?: string[];
  onNavigate?: (src: string) => void;
}) {
  const m = usePhotos()?.meta[src] ?? {};
  const webp = src.replace(/\.jpe?g$/i, ".webp");
  const exifLine = [m.year, m.camera, m.settings].filter(Boolean).join("  ·  ");
  // the filename stem doubles as the photo's id in inquiry prefills
  const photoId = src.split("/").pop()?.replace(/\.\w+$/, "") ?? "";

  const idx = srcs ? srcs.indexOf(src) : -1;
  const canNav = !!(srcs && onNavigate && srcs.length > 1 && idx !== -1);
  const go = (dir: 1 | -1) => {
    if (!canNav || !srcs || !onNavigate) return;
    onNavigate(srcs[(idx + dir + srcs.length) % srcs.length]);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, src, srcs, onNavigate]);

  // Render into <body> so `position: fixed` resolves against the viewport, not
  // a transformed ancestor (the favorites gallery / LCD-zoom overlay both carry
  // transforms, which would otherwise offset this fixed overlay off-screen).
  return createPortal(
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
      {canNav && (
        <>
          <button
            className="lb-nav prev"
            aria-label="Previous photo"
            onClick={(e) => { e.stopPropagation(); go(-1); }}
          >
            ←
          </button>
          <button
            className="lb-nav next"
            aria-label="Next photo"
            onClick={(e) => { e.stopPropagation(); go(1); }}
          >
            →
          </button>
        </>
      )}
      <motion.div
        key={src}
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
                <Link
                  className="lb-link accent"
                  to={`/prints?photo=${encodeURIComponent(photoId)}`}
                  onClick={onClose}
                  data-cursor="view"
                >
                  See it on your wall →
                </Link>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}
