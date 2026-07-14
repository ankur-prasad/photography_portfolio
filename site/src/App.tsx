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
import ConsentBanner from "./components/ConsentBanner";

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
const ImpressumPage = lazy(() => import("./pages/LegalPage").then((m) => ({ default: m.ImpressumPage })));
const DatenschutzPage = lazy(() => import("./pages/LegalPage").then((m) => ({ default: m.DatenschutzPage })));
const PrivacyPolicyPage = lazy(() => import("./pages/LegalPage").then((m) => ({ default: m.PrivacyPolicyPage })));
const TermsPage = lazy(() => import("./pages/LegalPage").then((m) => ({ default: m.TermsPage })));
const NutzungsbedingungenPage = lazy(() => import("./pages/LegalPage").then((m) => ({ default: m.NutzungsbedingungenPage })));
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
          <ConsentBanner />
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/work" element={<WorkPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/prints" element={<PrintsPage />} />
              <Route path="/lab" element={<LabPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/impressum" element={<ImpressumPage />} />
              <Route path="/datenschutz" element={<DatenschutzPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/nutzungsbedingungen" element={<NutzungsbedingungenPage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </MotionConfig>
    </LenisContext.Provider>
  );
}
