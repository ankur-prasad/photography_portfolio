interface PhotoProps {
  /** a /web/<name>.jpg path; the matching .webp is served first when supported */
  src: string;
  alt: string;
  loading?: "lazy" | "eager";
}

/**
 * Serves WebP (≈70% lighter) with a JPEG fallback. `display:contents` on the
 * <picture> keeps the existing `figure > img` grid layout/CSS intact.
 * Note: the .webp must exist — a 404 <source> does not fall back. The asset
 * pipeline (tools/prep_site_assets.py) generates one next to every web .jpg.
 */
export default function Photo({ src, alt, loading = "lazy" }: PhotoProps) {
  const webp = src.replace(/\.jpe?g$/i, ".webp");
  return (
    <picture style={{ display: "contents" }}>
      <source srcSet={webp} type="image/webp" />
      <img src={src} alt={alt} loading={loading} />
    </picture>
  );
}
