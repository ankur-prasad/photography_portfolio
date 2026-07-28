/* ============================================================================
   usePrintConfig — the whole print order state, in one place.

   Extracted from PrintShop when /prints gained a second presentation (the
   scroll-driven 3D room). Both views drive the same hook, so the SKU, the
   price, the size list and the Stripe call cannot drift apart between them —
   which matters more here than anywhere else on the site, because a mismatch
   would mean charging for one thing and shipping another.

   The 3D room and the 2D configurator differ only in how they render this.
   ========================================================================== */

import { useState } from "react";
import { usePhotos } from "./usePhotos";
import { usePrintCatalog } from "./usePrintCatalog";
import { createCheckout } from "./checkout";
import {
  MOUNT_CM,
  bestSizes,
  dimsFor,
  type CatalogFinish,
  type CatalogSize,
  type SizedOption,
} from "../data/printConfig";
import type { PhotoMeta } from "../data/photos";

export const stemOf = (src: string) => src.split("/").pop()?.replace(/\.\w+$/, "") ?? "";

export interface PrintConfig {
  /** false while the catalog is still loading — render a placeholder */
  ready: boolean;
  finishes: CatalogFinish[];
  finish: CatalogFinish;
  sizeOptions: SizedOption[];
  size: SizedOption;
  color: string;
  optKey: string | undefined;
  optValues: string[];
  opt: string;
  /** photo aspect ratio, from photos.json where available */
  aspect: number;
  /** printed size in cm */
  dims: { w: number; h: number };
  /** physical mount width for this finish, in cm */
  mountCm: number;
  meta: PhotoMeta;
  id: string;
  /** prefilled contact-form fallback if checkout is unavailable */
  inquiryHref: string;
  buying: boolean;
  buyError: string | null;
  setFinishKey: (k: string) => void;
  setSkuChoice: (s: string) => void;
  setColorChoice: (c: string) => void;
  setOptChoice: (o: string) => void;
  /** probe fallback for photos with no stored dimensions */
  setProbedAspect: (a: number) => void;
  buy: () => Promise<void>;
}

export function usePrintConfig(selected: string): PrintConfig {
  const photos = usePhotos();
  const catalog = usePrintCatalog();
  const finishes = catalog?.finishes ?? [];

  const [finishKey, setFinishKey] = useState("box-frame");
  const [skuChoice, setSkuChoice] = useState<string | null>(null);
  const [colorChoice, setColorChoice] = useState<string | null>(null);
  const [optChoice, setOptChoice] = useState<string | null>(null);
  const [probedAspect, setProbedAspect] = useState(1.5);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);

  const meta = photos?.meta[selected];
  /* Aspect has to be right on the FIRST render: it decides which SKUs are even
     offered, and how big the 3D print is drawn. photos.json carries w/h; the
     probe is only a fallback. */
  const aspect = meta?.w && meta?.h ? meta.w / meta.h : probedAspect;

  const finish = finishes.find((f) => f.key === finishKey) ?? finishes[0];

  // Catalog not in yet — return a shape callers can bail on without crashing.
  if (!finish) {
    return {
      ready: false,
      finishes,
      finish: undefined as unknown as CatalogFinish,
      sizeOptions: [],
      size: undefined as unknown as SizedOption,
      color: "",
      optKey: undefined,
      optValues: [],
      opt: "",
      aspect,
      dims: { w: 0, h: 0 },
      mountCm: 0,
      meta: meta ?? {},
      id: stemOf(selected),
      inquiryHref: "/contact",
      buying,
      buyError,
      setFinishKey,
      setSkuChoice,
      setColorChoice,
      setOptChoice,
      setProbedAspect,
      buy: async () => {},
    };
  }

  const sizeOptions = bestSizes(aspect, finish);
  const size =
    sizeOptions.find((s) => s.sku === skuChoice) ?? sizeOptions[Math.min(1, sizeOptions.length - 1)];
  const color = finish.colors.includes(colorChoice ?? "") ? colorChoice! : finish.colors[0];
  const optKey = Object.keys(finish.options)[0];
  const optValues = optKey ? finish.options[optKey] : [];
  const opt = optValues.includes(optChoice ?? "") ? optChoice! : optValues[0];

  const dims = dimsFor(size, aspect);
  const id = stemOf(selected);
  const m = meta ?? {};

  const inquiryHref =
    `/contact?photo=${encodeURIComponent(id)}` +
    `&size=${encodeURIComponent(`${dims.w}x${dims.h}cm`)}` +
    `&finish=${encodeURIComponent(finish.label + (color ? ` (${color})` : ""))}` +
    (opt ? `&option=${encodeURIComponent(opt)}` : "") +
    `&sku=${encodeURIComponent(size.sku)}`;

  async function buy() {
    setBuying(true);
    setBuyError(null);
    const res = await createCheckout({
      photo: id,
      sku: size.sku,
      title: m.title,
      color: finish.colors.length > 1 ? color : undefined,
      option: optValues.length > 1 ? opt : undefined,
    });
    if (res.ok) {
      window.location.href = res.url;
      return; // navigating away
    }
    setBuyError(res.error);
    setBuying(false);
  }

  return {
    ready: true,
    finishes,
    finish,
    sizeOptions,
    size,
    color,
    optKey,
    optValues,
    opt,
    aspect,
    dims,
    mountCm: MOUNT_CM[finish.type] ?? 0,
    meta: m,
    id,
    inquiryHref,
    buying,
    buyError,
    setFinishKey: (k: string) => {
      setFinishKey(k);
      // A different finish has a different size list and option set.
      setSkuChoice(null);
      setOptChoice(null);
    },
    setSkuChoice,
    setColorChoice,
    setOptChoice,
    setProbedAspect,
    buy,
  };
}

export type { CatalogFinish, CatalogSize };
