import { useState } from "react";
import { dimsFor, COLOR_HEX, MOUNT_CM, type CatalogFinish, type CatalogSize } from "../data/printConfig";

/** The visible wall spans this many cm — everything in the scene is scaled
 *  against it, so the print resizes true-to-scale as sizes change. */
const WALL_CM = 300;
const SOFA_CM = 220;

const COLORABLE = new Set(["box-frame", "framed-canvas"]);

/* MOUNT_CM (the physical mount/gap between frame and print) moved to
   data/printConfig so RoomScene renders the same measurement to scale in 3D.
   CSS percentage padding resolves against the WALL, so cm→% here is exact. */

/**
 * A drawn-from-scratch room scene (no stock mockups): dark plaster wall, a
 * soft picture light, a sofa for scale, and the print hanging at real
 * proportions. Chrome follows the finish type (box frame with mount, float-
 * framed canvas, frameless acrylic/dibond, bare print) and frame colour.
 */
export default function RoomPreview({
  src,
  size,
  finish,
  color,
  onAspect,
}: {
  src: string;
  size: CatalogSize;
  finish: CatalogFinish;
  color?: string;
  onAspect?: (a: number) => void;
}) {
  const [aspect, setAspect] = useState(1.5);
  const dims = dimsFor(size, aspect);
  const mountCm = MOUNT_CM[finish.type] ?? 0;
  const outerW = dims.w + (finish.frameCm + mountCm) * 2;
  const outerH = dims.h + (finish.frameCm + mountCm) * 2;
  const widthPct = (outerW / WALL_CM) * 100;
  const frameColor = COLORABLE.has(finish.type) && color ? COLOR_HEX[color] : undefined;
  const mountPad = mountCm ? { padding: `${((mountCm / WALL_CM) * 100).toFixed(2)}%` } : {};

  return (
    <div className="room" aria-label={`Print shown to scale on a living-room wall, ${dims.w} by ${dims.h} centimetres`}>
      <div className="room-wall">
        <div className="room-glow" />
        <div
          className={`room-frame ${finish.type}`}
          style={{
            width: `${widthPct}%`,
            aspectRatio: `${outerW} / ${outerH}`,
            ...(frameColor ? { borderColor: frameColor } : {}),
            ...mountPad,
          }}
        >
          <img
            src={src.replace("/web/", "/mid/")}
            alt=""
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                const a = img.naturalWidth / img.naturalHeight;
                setAspect(a);
                onAspect?.(a);
              }
            }}
          />
          {finish.type === "acrylic" && <span className="acr-sheen" aria-hidden />}
        </div>
        <div className="room-sofa" style={{ width: `${(SOFA_CM / WALL_CM) * 100}%` }} aria-hidden>
          <span className="sofa-back" />
          <span className="sofa-seat" />
          <span className="sofa-arm left" />
          <span className="sofa-arm right" />
          <span className="sofa-cushion a" />
          <span className="sofa-cushion b" />
          <span className="sofa-leg left" />
          <span className="sofa-leg right" />
        </div>
        <div className="room-plant" aria-hidden>
          <span className="plant-leaf a" />
          <span className="plant-leaf b" />
          <span className="plant-leaf c" />
          <span className="plant-pot" />
        </div>
      </div>
      <div className="room-floor" />
      <span className="room-scale">
        Shown to scale — {dims.w} × {dims.h} cm{finish.frameCm ? " framed" : ""} · sofa 220 cm
      </span>
    </div>
  );
}
