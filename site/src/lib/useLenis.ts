import { useEffect, useState } from "react";
import Lenis from "lenis";

export function useLenis() {
  const [lenis, setLenis] = useState<Lenis | null>(null);

  useEffect(() => {
    // Honour prefers-reduced-motion: keep Lenis (for anchor scrolling) but drop
    // the eased smoothing so scrolling feels native.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const instance = new Lenis({
      lerp: reduced ? 1 : 0.09,
      smoothWheel: !reduced,
      anchors: true,
    });
    // Lenis is a browser-only external instance that must be built post-mount;
    // consumers (ScrollManager via LenisContext) need this state update to react to it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLenis(instance);
    if (import.meta.env.DEV) {
      (window as unknown as { lenis: Lenis }).lenis = instance;
    }

    let raf: number;
    const loop = (time: number) => {
      instance.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      instance.destroy();
    };
  }, []);

  return lenis;
}
