import { Link } from "react-router-dom";
import { usePageTitle } from "../lib/usePageTitle";

export default function NotFoundPage() {
  usePageTitle("404 — Frame Not Found · Ankur Prasad");
  return (
    <main className="notfound">
      <div className="container">
        <p className="notfound-code">ERR 404 — NO SIGNAL</p>
        <h1 className="notfound-title">Frame not found.</h1>
        <p className="notfound-body">
          Whatever you were aiming at isn&apos;t in this roll. Wind back, or jump
          to a frame that exists.
        </p>
        <div className="notfound-links">
          <Link to="/" data-cursor="view">← Back to the top</Link>
          <Link to="/work" data-cursor="view">The Work</Link>
          <Link to="/contact" className="accent" data-cursor="email">Work with me →</Link>
        </div>
      </div>
      <div className="notfound-frame" aria-hidden>
        <span className="hud-bracket tl" />
        <span className="hud-bracket tr" />
        <span className="hud-bracket bl" />
        <span className="hud-bracket br" />
      </div>
    </main>
  );
}
