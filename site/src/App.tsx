import { lazy, Suspense, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { useLenis } from "./lib/useLenis";
import { LenisContext } from "./lib/LenisContext";
import Cursor from "./components/Cursor";
import Loader from "./components/Loader";
import Nav from "./components/Nav";
import Hud from "./components/Hud";
import ScrollManager from "./components/ScrollManager";

// Route + dev-tool code-splitting: three.js / R3F (~1.4MB) is only pulled into
// the chunks that actually render 3D (home's CameraExperience, the lab, and the
// dev sandboxes). The main bundle and the about/work/services chunks stay light.
const HomePage = lazy(() => import("./pages/HomePage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const WorkPage = lazy(() => import("./pages/WorkPage"));
const ServicesPage = lazy(() => import("./pages/ServicesPage"));
const PrintsPage = lazy(() => import("./pages/PrintsPage"));
const LabPage = lazy(() => import("./pages/LabPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const ModelInspector = lazy(() => import("./components/ModelInspector"));
const AssetLab = lazy(() => import("./components/AssetLab"));

/** Hud is keyed to CameraExperience's own scroll-act DOM nodes — only meaningful on Home. */
function HudOnHome() {
  const { pathname } = useLocation();
  return pathname === "/" ? <Hud /> : null;
}

export default function App() {
  const lenis = useLenis();
  const [, setLoaded] = useState(false);

  if (typeof window !== "undefined" && window.location.search.includes("lab")) {
    return (
      <Suspense fallback={null}>
        <AssetLab />
      </Suspense>
    );
  }
  if (typeof window !== "undefined" && window.location.search.includes("inspect")) {
    return (
      <Suspense fallback={null}>
        <ModelInspector />
      </Suspense>
    );
  }

  return (
    <LenisContext.Provider value={lenis}>
      <MotionConfig reducedMotion="user">
        <BrowserRouter>
          <Cursor />
          <Loader onDone={() => setLoaded(true)} />
          <ScrollManager />
          <HudOnHome />
          <Nav />
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/work" element={<WorkPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/prints" element={<PrintsPage />} />
              <Route path="/lab" element={<LabPage />} />
              <Route path="/contact" element={<ContactPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </MotionConfig>
    </LenisContext.Provider>
  );
}
