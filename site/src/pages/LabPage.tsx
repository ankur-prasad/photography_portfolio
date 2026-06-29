import AILab from "../components/AILab";
import Footer from "../components/Footer";
import { usePageTitle } from "../lib/usePageTitle";

export default function LabPage() {
  usePageTitle(
    "AI Lab — Ankur Prasad",
    "The AI Lab — depth-driven, step-into photographs by Ankur Prasad."
  );
  return (
    <main className="page">
      <AILab />
      <Footer />
    </main>
  );
}
