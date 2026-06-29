import { lazy, Suspense } from "react";
import Intro from "../components/Intro";
import Gallery from "../components/Gallery";
import Footer from "../components/Footer";
import HeroPoster from "../components/HeroPoster";
import { usePageTitle } from "../lib/usePageTitle";

// The 3D camera (three.js / R3F) is the heaviest dependency in the app — load it
// in its own chunk so the home shell + gallery paint first, with HeroPoster as a
// seamless static stand-in until the interactive scene is ready.
const CameraExperience = lazy(() => import("../components/CameraExperience"));

export default function HomePage() {
  usePageTitle("Ankur Prasad — Photographer × AI Engineer");
  return (
    <main id="top">
      <Suspense fallback={<HeroPoster />}>
        <CameraExperience />
      </Suspense>
      <Gallery />
      <Intro />
      <Footer />
    </main>
  );
}
