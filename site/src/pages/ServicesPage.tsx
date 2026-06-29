import Services from "../components/Services";
import Faq from "../components/Faq";
import Footer from "../components/Footer";
import { usePageTitle } from "../lib/usePageTitle";

export default function ServicesPage() {
  usePageTitle(
    "Services — Photography, Web & AI Consulting — Ankur Prasad",
    "Hire Ankur Prasad — photography commissions, cinematic brand sites built from scratch, and AI strategy & consulting. Project-based, replies within 24 hours."
  );
  return (
    <main className="page">
      <Services />
      <Faq />
      <Footer />
    </main>
  );
}
