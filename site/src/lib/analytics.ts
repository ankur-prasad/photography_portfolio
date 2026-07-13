/** Privacy-friendly analytics (Plausible), gated on an env var so the site
 *  ships analytics-ready but sends nothing until the account exists.
 *
 *  To activate: create the site in Plausible, then set
 *    VITE_PLAUSIBLE_DOMAIN=your-domain.com
 *  in site/.env.local (and in the host's env for production builds).
 *
 *  Plausible's default script auto-tracks SPA route changes via the History
 *  API, so no per-route wiring is needed. No cookies, GDPR-safe without a
 *  consent banner. */
export function initAnalytics() {
  const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;
  if (!domain || import.meta.env.DEV) return;
  const s = document.createElement("script");
  s.defer = true;
  s.dataset.domain = domain;
  s.src = "https://plausible.io/js/script.js";
  document.head.appendChild(s);
}
