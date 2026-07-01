import { Link } from "react-router-dom";
import Inquiry from "./Inquiry";

export default function Footer({ showInquiry = true }: { showInquiry?: boolean }) {
  const year = 2026;
  return (
    <>
      {showInquiry && <Inquiry />}

      <footer className="footer">
        <div className="container">
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
                <li><a href="#contact">Contact</a></li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Elsewhere</h4>
              <ul>
                <li><a href="https://www.instagram.com/prasadankur11/" target="_blank" rel="noreferrer">Instagram ↗</a></li>
                <li><a href="https://github.com/ankur-prasad" target="_blank" rel="noreferrer">GitHub ↗</a></li>
                <li><a href="mailto:prasadankur11@gmail.com">Email ↗</a></li>
              </ul>
            </div>
          </div>

          <div className="footer-base">
            <span>© {year} Ankur Prasad — All frames are mine</span>
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
