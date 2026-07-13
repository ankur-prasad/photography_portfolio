// Print-shop types + selection logic. The actual catalog (finishes, sizes,
// colors, prices) is DATA: generated from the live Prodigi account by
// tools/build_print_catalog.py into /data/print-catalog.json and loaded via
// lib/usePrintCatalog. Regenerate the JSON to change products or prices.

export interface CatalogSize {
  sku: string;
  longCm: number;
  shortCm: number;
  /** long/short, always >= 1 */
  aspect: number;
  label: string;
  wholesaleEUR: number;
  retailEUR: number;
}

export interface CatalogFinish {
  key: string;
  label: string;
  desc: string;
  /** drives the room-preview chrome */
  type: "print" | "box-frame" | "canvas" | "framed-canvas" | "acrylic" | "dibond";
  frameCm: number;
  colors: string[];
  options: Record<string, string[]>;
  sizes: CatalogSize[];
}

export interface PrintCatalog {
  finishes: CatalogFinish[];
}

/** swatch + frame-chrome colours for Prodigi colour attribute values */
export const COLOR_HEX: Record<string, string> = {
  black: "#101012",
  white: "#f4f2ee",
  natural: "#c8a878",
  brown: "#6b4a32",
  gold: "#b98a2e",
  silver: "#b9bcc2",
  "dark grey": "#3a3a3e",
  "light grey": "#a9a9ad",
};

export type CropLevel = "none" | "slight" | "fit";

export interface SizedOption extends CatalogSize {
  crop: CropLevel;
}

/**
 * Sizes that fit THIS photo: rank the finish's sizes by aspect-ratio distance
 * (orientation-agnostic), keep the best-fitting ones, order by print area.
 * A 3:2 landscape gets 3:2 rects, a square crop gets squares, a stitched
 * panorama gets the pano SKUs.
 */
export function bestSizes(photoAspect: number, finish: CatalogFinish, n = 5): SizedOption[] {
  const a = photoAspect >= 1 ? photoAspect : 1 / photoAspect;
  const scored = finish.sizes.map((s) => {
    const cropFrac = Math.exp(Math.abs(Math.log(s.aspect / a))) - 1;
    const crop: CropLevel = cropFrac <= 0.06 ? "none" : cropFrac <= 0.15 ? "slight" : "fit";
    return { ...s, crop, _fit: cropFrac };
  });
  scored.sort((x, y) => x._fit - y._fit);
  // prefer no/slight-crop sizes; pad with nearest others so there are >= 3 choices
  let picked = scored.filter((s) => s.crop !== "fit").slice(0, n);
  if (picked.length < 3) picked = scored.slice(0, Math.min(3, scored.length));
  picked.sort((x, y) => x.longCm * x.shortCm - y.longCm * y.shortCm);
  return picked.map(({ _fit, ...s }) => s);
}

/** oriented print dimensions in cm — the photo's aspect decides orientation */
export function dimsFor(size: CatalogSize, photoAspect: number): { w: number; h: number } {
  return photoAspect >= 1
    ? { w: size.longCm, h: size.shortCm }
    : { w: size.shortCm, h: size.longCm };
}
