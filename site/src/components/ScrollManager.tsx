import { useContext, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { LenisContext } from "../lib/LenisContext";

/** Resets scroll and re-measures Lenis on every route change. */
export default function ScrollManager() {
  const { pathname } = useLocation();
  const lenis = useContext(LenisContext);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      lenis?.resize();
      lenis?.scrollTo(0, { immediate: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname, lenis]);

  return null;
}
