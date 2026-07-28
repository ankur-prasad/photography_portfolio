/* ============================================================================
   PrintsRoom — the print configurator, with a real living room as the backdrop.

   The room fills the viewport; every choice lives in one panel on the right and
   is answered immediately by the print on the wall. Three framings (Room / Wall
   / Detail) let the customer get closer without losing the print — deliberately
   not free orbit, and deliberately not a scroll narrative: comparing two frame
   colours should cost one click, not six screens of scrolling.

   All state comes from usePrintConfig, the same hook the flat fallback uses, so
   the two presentations cannot disagree about the SKU or the price. Nothing here
   touches the Stripe path.
   ========================================================================== */

import { Suspense, lazy, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ErrorBoundary from "./ErrorBoundary";
import { DETAIL_VIEWS, ROOM_VIEWS, ROOM_VIEW_LIST } from "../data/roomScript";
import { COLOR_HEX } from "../data/printConfig";
import type { PrintConfig } from "../lib/usePrintConfig";

const RoomScene = lazy(() => import("./RoomScene"));

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface PrintsRoomProps {
  cfg: PrintConfig;
  picks: string[];
  selected: string;
  onSelect: (src: string) => void;
}

export default function PrintsRoom({ cfg, picks, selected, onSelect }: PrintsRoomProps) {
  /* ?view=room|wall|detail chooses the opening framing, for tuning shots
     without clicking through the UI. */
  const initialView = useMemo(() => {
    if (typeof window === "undefined") return 0;
    const v = new URLSearchParams(window.location.search).get("view");
    return v && v in ROOM_VIEWS ? ROOM_VIEWS[v] : 0;
  }, []);

  const [view, setView] = useState(initialView);
  /** active per-finish close-up, or null when showing a room framing */
  const [detail, setDetail] = useState<string | null>(null);

  /* FlightRig reads progress from a ref every frame rather than from state, so
     the camera can ease between framings without re-rendering the panel. */
  const viewRef = useRef(initialView);
  const setFraming = (p: number) => {
    viewRef.current = p;
    setView(p);
    setDetail(null);
  };

  const { finish, size, sizeOptions, color, optKey, optValues, opt, dims, meta } = cfg;
  const hasColor = finish.colors.length > 1;
  const hasOption = optValues.length > 1;

  return (
    <section className="prints-room">
      <div className="prints-canvas" aria-hidden>
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <RoomScene
              src={selected}
              size={size}
              finish={finish}
              color={color}
              aspect={cfg.aspect}
              progressRef={viewRef}
              detail={detail}
            />
          </Suspense>
        </ErrorBoundary>
      </div>

      {/* Darkens the right side so the panel stays legible over a lit wall,
          without dimming the print — the one thing that must stay colour-true. */}
      <div className="prints-veil" aria-hidden />

      {/* The gallery label: which photograph this is. On the room rather than in
          the panel, because it describes the artwork, not the order — and the
          panel needs every pixel to fit its options without scrolling. */}
      <div className="prints-caption">
        <p className="eyebrow">// On your wall</p>
        <h1 className="prints-caption-title">{meta.title ?? "Take one home"}</h1>
        {meta.location && <p className="prints-caption-loc">{meta.location}</p>}
      </div>

      {/* Framing switcher lives on the room, not in the panel — it controls the
          camera, not the product, and keeping it out means every actual option
          fits in the panel without a scroll area. */}
      <div className="prints-views" role="group" aria-label="Camera framing">
        {ROOM_VIEW_LIST.map((v) => (
          <button
            key={v.key}
            type="button"
            className={!detail && view === v.p ? "chip sm active" : "chip sm"}
            onClick={() => setFraming(v.p)}
          >
            {v.label}
          </button>
        ))}
        {/* Close-ups of the finish actually selected — the corner where the
            mitre and mount read, the edge where thickness reads. Generated from
            the configured print, so it is this photograph at this size. */}
        {(DETAIL_VIEWS[finish.type] ?? []).map((d) => (
          <button
            key={d.key}
            type="button"
            className={detail === d.key ? "chip sm active is-detail" : "chip sm is-detail"}
            onClick={() => setDetail(d.key)}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* ---- everything you choose, in one place ---- */}
      <aside className="prints-config">
        <div className="prints-config-fields">
          <div className="shop-field">
            <span className="shop-label">Finish</span>
            <div className="chip-row tight">
              {cfg.finishes.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={f.key === finish.key ? "chip sm active" : "chip sm"}
                  onClick={() => cfg.setFinishKey(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="shop-finish-desc">{finish.desc}</p>
          </div>

          {/* Colour and edge/surface are short lists, so they sit side by side.
              Framed canvas is the only finish that has both, and stacking them
              was what pushed the panel past one viewport. */}
          {(hasColor || hasOption) && (
            <div className={hasColor && hasOption ? "prints-config-pair" : undefined}>
              {hasColor && (
                <div className="shop-field">
                  <span className="shop-label">Frame colour</span>
                  <div className="chip-row tight">
                    {finish.colors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={c === color ? "chip sm swatch active" : "chip sm swatch"}
                        onClick={() => cfg.setColorChoice(c)}
                      >
                        <span className="swatch-dot" style={{ background: COLOR_HEX[c] ?? c }} />
                        {cap(c)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {hasOption && (
                <div className="shop-field">
                  <span className="shop-label">
                    {optKey === "wrap" ? "Edge wrap" : optKey === "finish" ? "Surface" : cap(optKey ?? "")}
                  </span>
                  <div className="chip-row tight">
                    {optValues.map((v) => (
                      <button
                        key={v}
                        type="button"
                        className={v === opt ? "chip sm active" : "chip sm"}
                        onClick={() => cfg.setOptChoice(v)}
                      >
                        {cap(v)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                  onClick={() => cfg.setSkuChoice(s.sku)}
                >
                  {s.label}
                  {s.crop !== "none" && <em className="chip-crop"> · crop</em>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pinned to the bottom of the panel so the price and the button are
            never scrolled out of reach on a short viewport. */}
        <div className="prints-config-buy">
          <div className="shop-price">
            <span className="shop-price-num">€{size.retailEUR}</span>
            <span className="shop-price-note">
              {dims.w} × {dims.h} cm · shown to scale · signed &amp; numbered
              {size.crop !== "none" && " · slight crop to fit"}
            </span>
          </div>
          <button className="shop-cta" onClick={cfg.buy} disabled={cfg.buying} data-cursor="email">
            {cfg.buying ? "Redirecting to checkout…" : "Order this print →"}
          </button>
          {cfg.buyError ? (
            <p className="shop-cta-note error">
              Checkout&apos;s briefly unavailable ({cfg.buyError}). You can still{" "}
              <Link to={cfg.inquiryHref}>send me the order directly →</Link>
            </p>
          ) : (
            <p className="shop-cta-note">
              Secure Stripe checkout · colours vary by display.
            </p>
          )}
        </div>
      </aside>

      {/* ---- photo picker ---- */}
      <div className="prints-strip" role="listbox" aria-label="Choose a print">
        {picks.map((src) => (
          <button
            key={src}
            type="button"
            role="option"
            aria-selected={src === selected}
            className={src === selected ? "strip-thumb active" : "strip-thumb"}
            onClick={() => onSelect(src)}
          >
            <img src={src.replace("/web/", "/thumbs/")} alt="" loading="lazy" />
          </button>
        ))}
      </div>
    </section>
  );
}
