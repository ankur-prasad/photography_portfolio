interface PhotoProps {
  /** a /web/<name>.jpg path; matching /thumbs/ + .webp variants are derived */
  src: string;
  alt: string;
  loading?: "lazy" | "eager";
  /** how wide this image renders — lets the browser pick thumb (480w) vs web (1400w) */
  sizes?: string;
}

/**
 * Responsive photo: WebP-first with JPEG fallback and a 3-step size ladder —
 * 480w thumb (1x grid cells), 960w mid (retina grid cells), 1400w web
 * (lightbox / large slots). Grids pull ~25-90KB per image instead of ~300KB,
 * which is what keeps a 371-photo site smooth. `display:contents` keeps the
 * existing `figure > img` grid CSS intact.
 * Note: /web/x.jpg MUST have .webp + /mid/ + /thumbs/ variants — generated
 * together by tools/import_photos.py (a 404 <source> does not fall back).
 */
export default function Photo({
  src,
  alt,
  loading = "lazy",
  sizes = "(max-width: 760px) 100vw, 33vw",
}: PhotoProps) {
  const webp = src.replace(/\.jpe?g$/i, ".webp");
  const ladder = (s: string) =>
    `${s.replace("/web/", "/thumbs/")} 480w, ${s.replace("/web/", "/mid/")} 960w, ${s} 1400w`;
  return (
    <picture style={{ display: "contents" }}>
      <source type="image/webp" srcSet={ladder(webp)} sizes={sizes} />
      <img src={src} srcSet={ladder(src)} sizes={sizes} alt={alt} loading={loading} />
    </picture>
  );
}
