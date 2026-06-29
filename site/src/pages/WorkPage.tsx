import Work from "../components/Work";
import Footer from "../components/Footer";
import { usePageTitle } from "../lib/usePageTitle";

export default function WorkPage() {
  usePageTitle(
    "Work — Ankur Prasad",
    "Selected photography by Ankur Prasad — night & light, land & layers, geometry, stillness and motion, from the Alps to NYC, the Southwest, the Canaries and India."
  );
  return (
    <main className="page">
      <Work />
      <Footer />
    </main>
  );
}
