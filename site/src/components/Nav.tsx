import { Link, NavLink } from "react-router-dom";
import { trackEvent } from "../lib/analytics";

export default function Nav() {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link className="nav-mark" to="/" data-cursor="top">
          A / P
        </Link>
        <div className="nav-links">
          <NavLink to="/work">Work</NavLink>
          <NavLink to="/prints">Prints</NavLink>
          <NavLink to="/about">About</NavLink>
          <NavLink to="/services">Services</NavLink>
          <Link
            className="nav-cta"
            to="/contact"
            data-cursor="email"
            onClick={() => trackEvent("Nav CTA Clicked")}
          >
            Work with me
          </Link>
        </div>
      </div>
    </nav>
  );
}
