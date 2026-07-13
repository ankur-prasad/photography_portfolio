import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { useLenis } from "./lib/useLenis";
import { LenisContext } from "./lib/LenisContext";
import Cursor from "./components/Cursor";
import Loader from "./components/Loader";
import Nav from "./components/Nav";
import Hud from "./components/Hud";
import Toc from "./components/Toc";
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
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const GermanPage = lazy(() => import("./pages/GermanPage"));
const CaseStudyPage = lazy(() => import("./pages/CaseStudyPage"));
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

/** The TOC's jump targets are positions inside the camera act — Home-only too. */
function TocOnHome() {
  const { pathname } = useLocation();
  return pathname === "/" ? <Toc /> : null;
}

/** The intro loader is a brand moment, not a paywall: play it only when the
 *  session starts on Home, and only once per session — someone following a
 *  deep link (e.g. straight to /contact) gets the page immediately. */
function IntroLoader({ onDone }: { onDone: () => void }) {
  const { pathname } = useLocation();
  const [show] = useState(() => {
    if (pathname !== "/") return false;
    try {
      if (sessionStorage.getItem("intro-played")) return false;
      sessionStorage.setItem("intro-played", "1");
    } catch {
      /* storage unavailable (privacy mode) — still play the intro */
    }
    return true;
  });
  useEffect(() => {
    if (!show) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once on mount
  }, []);
  return show ? <Loader onDone={onDone} /> : null;
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
          <IntroLoader onDone={() => setLoaded(true)} />
          <ScrollManager />
          <HudOnHome />
          <TocOnHome />
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
              <Route path="/work/perfectworld" element={<CaseStudyPage />} />
              <Route path="/de" element={<GermanPage />} />
              <Route path="/impressum" element={<ImpressumPage />} />
              <Route path="/datenschutz" element={<DatenschutzPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/nutzungsbedingungen" element={<NutzungsbedingungenPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
          <SpeedInsights />
        </BrowserRouter>
      </MotionConfig>
    </LenisContext.Provider>
  );
}
