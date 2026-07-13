import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

/**
 * Honest, non-blocking privacy notice — NOT a cookie-consent gate.
 * The site sets zero tracking cookies (Plausible is cookieless, storage is
 * functional-only), so there is nothing to opt into. This is a one-time
 * courtesy notice that links to the privacy policy and remembers dismissal.
 * German copy + links when the visitor is on a German route.
 */
const KEY = "notice-dismissed";

export default function ConsentBanner() {
  const { pathname } = useLocation();
  const de =
    pathname.startsWith("/de") ||
    pathname === "/datenschutz" ||
    pathname === "/nutzungsbedingungen" ||
    pathname === "/impressum";

  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false; // storage blocked (privacy mode) — show the notice
    }
  });

  if (dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* storage unavailable — just hide it for this view */
    }
    setDismissed(true);
  }

  return (
    <div className="consent-notice" role="note" aria-label={de ? "Datenschutzhinweis" : "Privacy notice"}>
      <p className="consent-notice-text">
        {de ? (
          <>
            Keine Tracking-Cookies — nur datenschutzfreundliche, cookielose
            Analyse.{" "}
            <Link to="/datenschutz" className="footer-legal-link">Datenschutz</Link>
          </>
        ) : (
          <>
            No tracking cookies here — just privacy-friendly, cookieless
            analytics.{" "}
            <Link to="/privacy" className="footer-legal-link">Privacy Policy</Link>
          </>
        )}
      </p>
      <button type="button" className="consent-notice-btn" onClick={dismiss}>
        {de ? "Verstanden" : "Got it"}
      </button>
    </div>
  );
}
