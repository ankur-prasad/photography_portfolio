import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { getAnalyticsConsent, grantAnalyticsConsent, revokeAnalyticsConsent } from "../lib/analytics";

/**
 * Proper opt-in consent banner: analytics (Plausible pageviews + named
 * interaction events like "Inquiry Submitted") only starts once a visitor
 * clicks Accept. No pre-checked boxes, no dark patterns — Accept and Reject
 * are equally weighted. Re-openable any time via the "Privacy settings"
 * link in the footer (dispatches the "open-consent-banner" window event).
 */
export const OPEN_EVENT = "open-consent-banner";

export default function ConsentBanner() {
  const { pathname } = useLocation();
  const de =
    pathname.startsWith("/de") ||
    pathname === "/datenschutz" ||
    pathname === "/nutzungsbedingungen" ||
    pathname === "/impressum";

  const [visible, setVisible] = useState(() => getAnalyticsConsent() === null);

  useEffect(() => {
    const reopen = () => setVisible(true);
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);

  if (!visible) return null;

  function accept() {
    grantAnalyticsConsent();
    setVisible(false);
  }
  function reject() {
    revokeAnalyticsConsent();
    setVisible(false);
  }

  return (
    <div className="consent-notice" role="dialog" aria-label={de ? "Datenschutz-Einwilligung" : "Privacy consent"}>
      <p className="consent-notice-text">
        {de ? (
          <>
            Diese Website möchte datenschutzfreundliche, cookielose Analyse
            (Plausible) nutzen, um zu sehen, welche Seiten ankommen. Ihre
            Wahl können Sie jederzeit über &bdquo;Datenschutz-Einstellungen&ldquo;
            im Footer ändern.{" "}
            <Link to="/datenschutz" className="footer-legal-link">Mehr erfahren</Link>
          </>
        ) : (
          <>
            This site would like to use privacy-friendly, cookieless analytics
            (Plausible) to see which pages resonate. You can change your mind
            any time via “Privacy settings” in the footer.{" "}
            <Link to="/privacy" className="footer-legal-link">Learn more</Link>
          </>
        )}
      </p>
      <div className="consent-notice-actions">
        <button type="button" className="consent-notice-btn ghost" onClick={reject}>
          {de ? "Ablehnen" : "Reject"}
        </button>
        <button type="button" className="consent-notice-btn" onClick={accept}>
          {de ? "Akzeptieren" : "Accept"}
        </button>
      </div>
    </div>
  );
}
