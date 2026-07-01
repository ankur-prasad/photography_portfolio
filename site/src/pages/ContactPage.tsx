import Inquiry from "../components/Inquiry";
import Footer from "../components/Footer";
import { usePageTitle } from "../lib/usePageTitle";

export default function ContactPage() {
  usePageTitle(
    "Work With Me — Ankur Prasad",
    "Drop an inquiry brief to collaborate on photography commissions, web experience development, and AI consulting."
  );
  return (
    <main className="page" style={{ paddingTop: "120px" }}>
      <Inquiry />
      <Footer showInquiry={false} />
    </main>
  );
}
