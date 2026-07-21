import { useState } from "react";
import { Link } from "react-router-dom";
import { usePhotos } from "../lib/usePhotos";
import { usePrintCatalog } from "../lib/usePrintCatalog";
import { bestSizes, dimsFor, COLOR_HEX } from "../data/printConfig";
import { createCheckout } from "../lib/checkout";
import RoomPreview from "./RoomPreview";

const stemOf = (src: string) => src.split("/").pop()?.replace(/\.\w+$/, "") ?? "";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The print configurator: pick a frame, finish, colour and size, see it
 * hanging in a room at true scale, order. Finishes/sizes/prices come from
 * /data/print-catalog.json (generated from the live Prodigi account); the
 * size choices ADAPT to each photo's aspect ratio — panoramas get pano SKUs,
 * squares get squares. Checkout currently routes through the inquiry form
 * with the exact spec prefilled; once Stripe keys exist the CTA swaps to a
 * hosted checkout session — same UI, no redesign.
 */
export default function PrintShop({
  picks,
  selected,
  onSelect,
}: {
  picks: string[];
  selected: string;
  onSelect: (src: string) => void;
}) {
  const photos = usePhotos();
  const catalog = usePrintCatalog();
  const finishes = catalog?.finishes ?? [];

  const [finishKey, setFinishKey] = useState("box-frame");
  const [skuChoice, setSkuChoice] = useState<string | null>(null);
  const [colorChoice, setColorChoice] = useState<string | null>(null);
  const [optChoice, setOptChoice] = useState<string | null>(null);
  const [aspect, setAspect] = useState(1.5);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);

  const finish = finishes.find((f) => f.key === finishKey) ?? finishes[0];
  if (!finish) {
    return <section className="print-shop" id="configure" style={{ minHeight: "60vh" }} />;
  }

  const sizeOptions = bestSizes(aspect, finish);
  const size =
    sizeOptions.find((s) => s.sku === skuChoice) ??
    sizeOptions[Math.min(1, sizeOptions.length - 1)];
  const color = finish.colors.includes(colorChoice ?? "") ? colorChoice! : finish.colors[0];
  const optKey = Object.keys(finish.options)[0];
  const optValues = optKey ? finish.options[optKey] : [];
  const opt = optValues.includes(optChoice ?? "") ? optChoice! : optValues[0];

  const m = photos?.meta[selected] ?? {};
  const dims = dimsFor(size, aspect);
  const id = stemOf(selected);
  const inquiryHref =
    `/contact?photo=${encodeURIComponent(id)}` +
    `&size=${encodeURIComponent(`${dims.w}x${dims.h}cm`)}` +
    `&finish=${encodeURIComponent(finish.label + (color ? ` (${color})` : ""))}` +
    (opt ? `&option=${encodeURIComponent(opt)}` : "") +
    `&sku=${encodeURIComponent(size.sku)}`;

  async function onBuy() {
    setBuying(true);
    setBuyError(null);
    const res = await createCheckout({
      photo: id, sku: size.sku, title: m.title,
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

  return (
    <section className="print-shop" id="configure">
      <div className="container">
        <div className="shop-grid">
          <div className="shop-room">
            <RoomPreview
              src={selected}
              size={size}
              finish={finish}
              color={color}
              onAspect={setAspect}
            />
          </div>

          <div className="shop-panel">
            <p className="eyebrow">// On your wall</p>
            <h2 className="shop-title">{m.title ?? "Untitled"}</h2>
            {m.location && <p className="shop-loc">{m.location}</p>}

            <div className="shop-field">
              <span className="shop-label">Finish</span>
              <div className="chip-row tight">
                {finishes.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    className={f.key === finish.key ? "chip sm active" : "chip sm"}
                    onClick={() => { setFinishKey(f.key); setSkuChoice(null); setOptChoice(null); }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <p className="shop-finish-desc">{finish.desc}</p>
            </div>

            {finish.colors.length > 1 && (
              <div className="shop-field">
                <span className="shop-label">Frame colour</span>
                <div className="chip-row tight">
                  {finish.colors.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={c === color ? "chip sm swatch active" : "chip sm swatch"}
                      onClick={() => setColorChoice(c)}
                    >
                      <span className="swatch-dot" style={{ background: COLOR_HEX[c] ?? c }} />
                      {cap(c)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {optValues.length > 1 && (
              <div className="shop-field">
                <span className="shop-label">
                  {optKey === "wrap" ? "Edge wrap" : optKey === "finish" ? "Surface" : cap(optKey)}
                </span>
                <div className="chip-row tight">
                  {optValues.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={v === opt ? "chip sm active" : "chip sm"}
                      onClick={() => setOptChoice(v)}
                    >
                      {cap(v)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="shop-field">
              <span className="shop-label">Size — fitted to this photo</span>
              <div className="chip-row tight">
                {sizeOptions.map((s) => (
                  <button
                    key={s.sku}
                    type="button"
                    className={s.sku === size.sku ? "chip sm active" : "chip sm"}
                    onClick={() => setSkuChoice(s.sku)}
                  >
                    {s.label}
                    {s.crop !== "none" && <em className="chip-crop"> · crop</em>}
                  </button>
                ))}
              </div>
            </div>

            <div className="shop-buy">
              <div className="shop-price">
                <span className="shop-price-num">€{size.retailEUR}</span>
                <span className="shop-price-note">
                  {dims.w} × {dims.h} cm · signed &amp; numbered · ships worldwide
                  {size.crop !== "none" && " · slight crop to fit"}
                </span>
              </div>
              <button className="shop-cta" onClick={onBuy} disabled={buying} data-cursor="email">
                {buying ? "Redirecting to checkout…" : "Order this print →"}
              </button>
              {buyError ? (
                <p className="shop-cta-note error">
                  Checkout&apos;s briefly unavailable ({buyError}). You can still{" "}
                  <Link to={inquiryHref}>send me the order directly →</Link>
                </p>
              ) : (
                <p className="shop-cta-note">
                  Secure checkout via Stripe · signed &amp; numbered · ships worldwide.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="shop-strip" role="listbox" aria-label="Choose a print">
          {picks.map((src) => (
            <button
              key={src}
              type="button"
              role="option"
              aria-selected={src === selected}
              className={src === selected ? "strip-thumb active" : "strip-thumb"}
              onClick={() => onSelect(src)}
            >
              <img src={src.replace("/web/", "/thumbs/")} alt={photos?.meta[src]?.title ?? ""} loading="lazy" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

