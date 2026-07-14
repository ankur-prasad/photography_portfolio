/** Privacy-friendly analytics (Plausible) — cookieless, but opt-in via the
 *  consent banner so tracking (pageviews + interaction events) only starts
 *  after a visitor says yes.
 *
 *  To activate: create the site in Plausible, then set
 *    VITE_PLAUSIBLE_DOMAIN=your-domain.com
 *  in site/.env.local (and in the host's env for production builds).
 *
 *  Plausible's default script auto-tracks SPA route changes via the History
 *  API, so no per-route wiring is needed. */

const CONSENT_KEY = "analytics-consent";
let loaded = false;

type ConsentValue = "granted" | "denied";

function readConsent(): ConsentValue | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function getAnalyticsConsent(): ConsentValue | null {
  return readConsent();
}

/** Injects the Plausible script. Safe to call multiple times — only loads once. */
export function loadAnalytics() {
  if (loaded) return;
  const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;
  if (!domain || import.meta.env.DEV) return;
  loaded = true;
  const s = document.createElement("script");
  s.defer = true;
  s.dataset.domain = domain;
  // "tagged-events" extension lets trackEvent() below report custom interactions
  // (form submits, CTA clicks) alongside automatic pageviews.
  s.src = "https://plausible.io/js/script.tagged-events.js";
  document.head.appendChild(s);
}

/** Called once at boot: resumes tracking silently if consent was already granted. */
export function initAnalytics() {
  if (readConsent() === "granted") loadAnalytics();
}

/** Called by the consent banner when a visitor accepts. */
export function grantAnalyticsConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, "granted");
  } catch {
    /* storage unavailable — analytics just won't persist across reloads */
  }
  loadAnalytics();
}

/** Called by the consent banner when a visitor declines, or later revokes. */
export function revokeAnalyticsConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, "denied");
  } catch {
    /* storage unavailable */
  }
  // Plausible has no client-side "stop" call once loaded; declining before
  // load is what actually matters (loadAnalytics() is never invoked below).
}

declare global {
  interface Window {
    plausible?: (event: string, opts?: { props?: Record<string, string> }) => void;
  }
}

/** Fire a custom interaction event (e.g. "Inquiry Submitted"). No-ops silently
 *  if analytics hasn't loaded (not consented, no domain configured, or dev). */
export function trackEvent(name: string, props?: Record<string, string>) {
  window.plausible?.(name, props ? { props } : undefined);
}
