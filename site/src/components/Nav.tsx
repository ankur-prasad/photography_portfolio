import { Link, NavLink } from "react-router-dom";

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
          <a className="nav-cta" href="#contact" data-cursor="email">Work with me</a>
        </div>
      </div>
    </nav>
  );
}
