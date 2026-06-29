import { useEffect, useRef } from "react";

/**
 * Custom cursor — a fast dot + a lerped ring that grows over interactive
 * elements. Recreated in the spirit of kookie-kollective's follower cursor,
 * built from scratch with our own behaviour.
 */
export default function Cursor() {
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // skip on touch / coarse pointers
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    const target = { x: innerWidth / 2, y: innerHeight / 2 };
    const pos = { x: target.x, y: target.y };
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;
      if (dot.current) {
        dot.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      }
      if (label.current) {
        label.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
      }

      const el = (e.target as HTMLElement)?.closest(
        "a, button, [data-cursor]"
      ) as HTMLElement | null;
      const r = ring.current;
      if (!r) return;
      if (el) {
        r.classList.add("is-hover");
        const text = el.getAttribute("data-cursor");
        if (text && label.current) {
          label.current.textContent = text;
          label.current.classList.add("show");
        }
      } else {
        r.classList.remove("is-hover");
        label.current?.classList.remove("show");
      }
    };

    const onDown = () => ring.current?.classList.add("is-down");
    const onUp = () => ring.current?.classList.remove("is-down");

    const loop = () => {
      pos.x += (target.x - pos.x) * 0.18;
      pos.y += (target.y - pos.y) * 0.18;
      if (ring.current) {
        ring.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
      }
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div className="cursor-ring" ref={ring} aria-hidden />
      <div className="cursor-dot" ref={dot} aria-hidden />
      <div className="cursor-label" ref={label} aria-hidden />
    </>
  );
}
