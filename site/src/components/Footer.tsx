import { Link } from "react-router-dom";
import Inquiry from "./Inquiry";
import { OPEN_EVENT } from "./ConsentBanner";
import { trackEvent } from "../lib/analytics";

export default function Footer({ showInquiry = true }: { showInquiry?: boolean }) {
  const year = 2026;
  return (
    <>
      {showInquiry && <Inquiry />}

      <footer className="footer">
        <div className="container">
          <div className="footer-intro">
            <p className="eyebrow">// WHO&apos;S BEHIND THIS</p>
            <p className="footer-intro-body">
              Hi — I&apos;m Ankur. By day I engineer AI systems; the rest of the time I chase
              light. I designed, photographed and built everything on this site — no template,
              no stock, no agency.
            </p>
            <p className="footer-intro-cta">
              You&apos;ve seen how I see. <Link to="/contact" data-cursor="email">Tell me what you&apos;re making →</Link>
            </p>
          </div>

          <div className="footer-grid">
            <div className="footer-mark">
              Ankur
              <br />
              Prasad
            </div>

            <div className="footer-col">
              <h4>Index</h4>
              <ul>
                <li><Link to="/" data-cursor="top">Top</Link></li>
                <li><Link to="/work">The Work</Link></li>
                <li><Link to="/prints">Prints</Link></li>
                <li><Link to="/services">Services</Link></li>
                <li><Link to="/about">About</Link></li>
                <li><Link to="/lab">AI Lab</Link></li>
                <li><Link to="/contact">Contact</Link></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Elsewhere</h4>
              <ul>
                <li>
                  <a
                    href="https://www.instagram.com/prasadankur11/"
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackEvent("Outbound Link Clicked", { target: "instagram" })}
                  >
                    Instagram ↗
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/ankur-prasad"
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => trackEvent("Outbound Link Clicked", { target: "github" })}
                  >
                    GitHub ↗
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:prasadankur11@gmail.com"
                    onClick={() => trackEvent("Outbound Link Clicked", { target: "email" })}
                  >
                    Email ↗
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="footer-base">
            <span>
              © {year} Ankur Prasad — All frames are mine
              {" · "}
              <Link to="/privacy" className="footer-legal-link">Privacy</Link>
              {" · "}
              <Link to="/terms" className="footer-legal-link">Terms</Link>
              {" · "}
              <Link to="/impressum" className="footer-legal-link">Impressum</Link>
              {" · "}
              <Link to="/datenschutz" className="footer-legal-link">Datenschutz</Link>
              {" · "}
              <button
                type="button"
                className="footer-legal-link footer-legal-btn"
                onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
              >
                Privacy settings
              </button>
            </span>
            <span className="rec">
              <span className="dot" />
              Designed &amp; built from scratch · Munich
            </span>
            <span>Shot on Sony ⍺7 II</span>
          </div>
        </div>
      </footer>
    </>
  );
}
