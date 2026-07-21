import { Link } from "react-router-dom";
import Footer from "../components/Footer";
import { usePageTitle } from "../lib/usePageTitle";

/* Impressum + Datenschutzerklärung — gesetzlich erforderlich für einen
 * geschäftlichen Auftritt in Deutschland (§ 5 DDG, DSGVO).
 * Privacy Policy + Terms of Service (EN) + Nutzungsbedingungen (DE) für das
 * englischsprachige Publikum. Alle Texte sind Vorlagen, keine Rechtsberatung.
 * ⚠️ TODO(Ankur): ladungsfähige Anschrift eintragen — die [—]-Platzhalter
 * MÜSSEN vor dem Livegang ersetzt werden. */

export function ImpressumPage() {
  usePageTitle("Impressum — Ankur Prasad");
  return (
    <main className="page legal">
      <section className="legal-sec">
        <div className="container">
          <p className="eyebrow">// IMPRESSUM</p>
          <h1>Impressum</h1>

          <h2>Angaben gemäß § 5 DDG</h2>
          <p>
            Ankur Prasad
            <br />
            [Straße und Hausnummer]
            <br />
            [PLZ] München
            <br />
            Deutschland
          </p>

          <h2>Kontakt</h2>
          <p>
            E-Mail: <a href="mailto:prasadankur11@gmail.com">prasadankur11@gmail.com</a>
          </p>

          <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
          <p>Ankur Prasad, Anschrift wie oben.</p>

          <h2>Urheberrecht</h2>
          <p>
            Alle Fotografien und Inhalte auf dieser Website sind urheberrechtlich
            geschützt. Jede Verwendung außerhalb der Grenzen des Urheberrechts
            bedarf der vorherigen schriftlichen Zustimmung.
          </p>
        </div>
      </section>
      <Footer showInquiry={false} />
    </main>
  );
}

export function DatenschutzPage() {
  usePageTitle("Datenschutz — Ankur Prasad");
  return (
    <main className="page legal">
      <section className="legal-sec">
        <div className="container">
          <p className="eyebrow">// DATENSCHUTZ</p>
          <h1>Datenschutzerklärung</h1>

          <h2>1. Verantwortlicher</h2>
          <p>
            Ankur Prasad, [Straße und Hausnummer], [PLZ] München —{" "}
            <a href="mailto:prasadankur11@gmail.com">prasadankur11@gmail.com</a>
          </p>

          <h2>2. Kontakt- und Anfrageformular</h2>
          <p>
            Wenn Sie das Anfrageformular nutzen, werden die von Ihnen eingegebenen
            Daten (Name, E-Mail-Adresse, Projektangaben, Nachricht) zur Bearbeitung
            Ihrer Anfrage gespeichert. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b
            DSGVO (vorvertragliche Maßnahmen). Die Daten werden bei Supabase
            (Region EU, Frankfurt) gespeichert und nicht an Dritte weitergegeben.
            Gleiches gilt für die Print-Warteliste (E-Mail-Adresse, Art. 6 Abs. 1
            lit. a DSGVO); die Einwilligung ist jederzeit widerruflich.
          </p>

          <h2>3. Cookies</h2>
          <p>
            Diese Website setzt keine Cookies von Drittanbietern ohne Ihre
            Einwilligung. Technisch notwendiger Browser-Speicher (z.&nbsp;B. um die
            Intro-Animation pro Sitzung nur einmal abzuspielen) enthält keine
            personenbezogenen Daten.
          </p>

          <h2>4. Webanalyse</h2>
          <p>
            Diese Website nutzt Plausible Analytics, einen datenschutzfreundlichen
            Analysedienst ohne Cookies, um zu verstehen, welche Seiten und Fotos
            Besucher interessieren (Seitenaufrufe sowie einzelne Interaktionen wie
            das Absenden des Anfrageformulars). Plausible speichert keine
            personenbezogenen Daten, erstellt keine geräteübergreifenden Profile
            und gibt keine Daten an Werbenetzwerke weiter. Die Analyse startet erst,
            nachdem Sie im Einwilligungsbanner zugestimmt haben (Art. 6 Abs. 1 lit.
            a DSGVO); Sie können Ihre Zustimmung jederzeit über den Link
            &bdquo;Datenschutz-Einstellungen&ldquo; im Footer widerrufen.
          </p>

          <h2>5. Schriftarten</h2>
          <p>
            Alle Schriftarten werden lokal von diesem Server ausgeliefert
            (selbst gehostet). Es werden keine Schriften von externen Diensten wie
            Google Fonts nachgeladen; Ihre IP-Adresse wird dadurch nicht an Dritte
            übermittelt.
          </p>

          <h2>6. Hosting / Server-Logs</h2>
          <p>
            Beim Aufruf der Website verarbeitet der Hosting-Anbieter technisch
            notwendige Daten (IP-Adresse, Zeitpunkt, abgerufene Ressource) in
            Server-Logfiles. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.
          </p>

          <h2>7. Ihre Rechte</h2>
          <p>
            Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung
            der Verarbeitung, Datenübertragbarkeit sowie Widerspruch (Art. 15–21
            DSGVO) und das Recht auf Beschwerde bei einer Aufsichtsbehörde — in
            Bayern: BayLDA, Ansbach. Eine formlose E-Mail genügt.
          </p>

          <p style={{ marginTop: 40 }}>
            <Link to="/nutzungsbedingungen" className="footer-legal-link">
              → Nutzungsbedingungen
            </Link>
          </p>
        </div>
      </section>
      <Footer showInquiry={false} />
    </main>
  );
}

export function PrivacyPolicyPage() {
  usePageTitle(
    "Privacy Policy — Ankur Prasad",
    "How this site handles your data: opt-in cookieless analytics, EU-hosted forms, self-hosted fonts, and your GDPR rights."
  );
  return (
    <main className="page legal">
      <section className="legal-sec">
        <div className="container">
          <p className="eyebrow">// PRIVACY</p>
          <h1>Privacy Policy</h1>
          <p>
            This site is built to respect your privacy: no tracking cookies, no
            advertising networks, no third-party font CDNs, and analytics that only
            runs if you say yes. Below is exactly what is collected, why, and what
            rights you have. A German-language version is available as the{" "}
            <Link to="/datenschutz" className="footer-legal-link">Datenschutzerklärung</Link>.
          </p>

          <h2>1. Who is responsible</h2>
          <p>
            Ankur Prasad, Munich, Germany —{" "}
            <a href="mailto:prasadankur11@gmail.com">prasadankur11@gmail.com</a>.
            Full postal address in the{" "}
            <Link to="/impressum" className="footer-legal-link">Impressum</Link>.
          </p>

          <h2>2. Inquiry &amp; print-waitlist forms</h2>
          <p>
            When you use the inquiry form, the details you enter (name, email
            address, project type, budget, timeline and message) are stored to
            handle your request. The legal basis is Art. 6(1)(b) GDPR
            (pre-contractual measures). The print waitlist stores only your email
            address on the basis of your consent, Art. 6(1)(a) GDPR, which you can
            withdraw at any time. This data is stored with Supabase in the EU
            (Frankfurt), is never sold or shared with third parties for their own
            purposes, and is used only to reply to you.
          </p>

          <h2>3. Cookies &amp; storage</h2>
          <p>
            This site sets no third-party cookies without your consent. It uses
            functional browser storage for things like remembering that the intro
            animation already played this session — that never contains personal
            data.
          </p>

          <h2>4. Analytics — opt-in</h2>
          <p>
            This site uses Plausible Analytics, a privacy-friendly service that
            sets no cookies and builds no cross-device profiles. When you accept
            the consent banner, it records aggregate page views and a small set of
            named interaction events (for example, “Inquiry Submitted” or
            “Waitlist Joined”) so I can see which pages and offers resonate — never
            your name, email or message content. Analytics only starts after you
            accept, and you can change your mind at any time via “Privacy
            settings” in the footer. Legal basis: Art. 6(1)(a) GDPR (consent).
          </p>

          <h2>5. Fonts</h2>
          <p>
            All fonts are served locally from this site (self-hosted). No fonts are
            loaded from external services such as Google Fonts, so your IP address
            is not disclosed to any font provider.
          </p>

          <h2>6. Hosting &amp; server logs</h2>
          <p>
            When you visit, the hosting provider processes technically necessary
            data (IP address, timestamp, requested resource) in server log files.
            Legal basis: Art. 6(1)(f) GDPR.
          </p>

          <h2>7. Your rights</h2>
          <p>
            You have the right to access, rectification, erasure, restriction of
            processing, data portability and objection (Art. 15–21 GDPR), and the
            right to lodge a complaint with a supervisory authority — in Bavaria,
            the BayLDA in Ansbach. An informal email to the address above is
            enough to exercise any of these rights.
          </p>

          <p style={{ marginTop: 40 }}>
            <Link to="/terms" className="footer-legal-link">→ Terms of Service</Link>
          </p>
        </div>
      </section>
      <Footer showInquiry={false} />
    </main>
  );
}

export function TermsPage() {
  usePageTitle(
    "Terms of Service — Ankur Prasad",
    "The terms for using this website: copyright, permitted use, inquiries, prints, and liability."
  );
  return (
    <main className="page legal">
      <section className="legal-sec">
        <div className="container">
          <p className="eyebrow">// TERMS</p>
          <h1>Terms of Service</h1>
          <p>
            These terms govern your use of this website. By browsing it, you agree
            to them. A German-language version is available as the{" "}
            <Link to="/nutzungsbedingungen" className="footer-legal-link">Nutzungsbedingungen</Link>.
          </p>

          <h2>1. Intellectual property</h2>
          <p>
            Every photograph, design, animation and line of copy on this site was
            created by Ankur Prasad and is protected by copyright. All frames are
            mine. Nothing here may be copied, reproduced, republished, sold or used
            to train machine-learning models without prior written permission.
          </p>

          <h2>2. Permitted use</h2>
          <p>
            You may view this site for personal, non-commercial purposes. Any other
            use — including downloading, redistributing or adapting the images or
            code — requires written consent.
          </p>

          <h2>3. Inquiries &amp; quotes</h2>
          <p>
            Information on this site and any quote given in reply to an inquiry are
            non-binding and do not constitute an offer. A commission or engagement
            becomes binding only through a separate written agreement.
          </p>

          <h2>4. Prints</h2>
          <p>
            Print orders, when available, are governed by the separate order and
            delivery terms presented at the point of purchase. Prints are produced
            on demand; production and shipping timelines are indicative.
          </p>

          <h2>5. Third-party links</h2>
          <p>
            This site may link to external websites. I have no control over their
            content and accept no responsibility for it; the linked operators are
            solely responsible.
          </p>

          <h2>6. Limitation of liability</h2>
          <p>
            This site is provided “as is.” To the extent permitted by law, I accept
            no liability for damages arising from its use, except in cases of
            intent or gross negligence, or for injury to life, body or health.
          </p>

          <h2>7. Governing law</h2>
          <p>
            These terms are governed by the law of the Federal Republic of Germany.
            Questions? Email{" "}
            <a href="mailto:prasadankur11@gmail.com">prasadankur11@gmail.com</a>.
          </p>

          <p style={{ marginTop: 40 }}>
            <Link to="/privacy" className="footer-legal-link">→ Privacy Policy</Link>
          </p>
        </div>
      </section>
      <Footer showInquiry={false} />
    </main>
  );
}

export function NutzungsbedingungenPage() {
  usePageTitle("Nutzungsbedingungen — Ankur Prasad");
  return (
    <main className="page legal">
      <section className="legal-sec">
        <div className="container">
          <p className="eyebrow">// NUTZUNGSBEDINGUNGEN</p>
          <h1>Nutzungsbedingungen</h1>
          <p>
            Diese Bedingungen regeln die Nutzung dieser Website. Mit dem Aufruf der
            Seite stimmen Sie ihnen zu. Eine englischsprachige Fassung finden Sie
            unter{" "}
            <Link to="/terms" className="footer-legal-link">Terms of Service</Link>.
          </p>

          <h2>1. Urheberrecht</h2>
          <p>
            Sämtliche Fotografien, Gestaltung, Animationen und Texte dieser Website
            stammen von Ankur Prasad und sind urheberrechtlich geschützt. Kein
            Inhalt darf ohne vorherige schriftliche Zustimmung kopiert,
            vervielfältigt, veröffentlicht, verkauft oder zum Training von
            KI-Modellen verwendet werden.
          </p>

          <h2>2. Erlaubte Nutzung</h2>
          <p>
            Die Website darf zu privaten, nicht kommerziellen Zwecken angesehen
            werden. Jede weitere Nutzung — insbesondere das Herunterladen,
            Weiterverbreiten oder Bearbeiten der Bilder oder des Codes — bedarf der
            schriftlichen Zustimmung.
          </p>

          <h2>3. Anfragen &amp; Angebote</h2>
          <p>
            Angaben auf dieser Website sowie Kostenschätzungen in Antwort auf eine
            Anfrage sind unverbindlich und stellen kein Angebot dar. Ein Auftrag
            wird erst durch eine gesonderte schriftliche Vereinbarung verbindlich.
          </p>

          <h2>4. Prints</h2>
          <p>
            Für Print-Bestellungen gelten — sofern verfügbar — die gesonderten
            Bestell- und Lieferbedingungen, die beim Kauf angezeigt werden. Prints
            werden auf Bestellung gefertigt; Produktions- und Lieferzeiten sind
            Richtwerte.
          </p>

          <h2>5. Externe Links</h2>
          <p>
            Diese Website kann auf externe Seiten verlinken. Auf deren Inhalte habe
            ich keinen Einfluss und übernehme dafür keine Haftung; verantwortlich
            sind allein die jeweiligen Betreiber.
          </p>

          <h2>6. Haftungsbeschränkung</h2>
          <p>
            Die Website wird „wie besehen“ bereitgestellt. Soweit gesetzlich
            zulässig, wird keine Haftung für Schäden aus der Nutzung übernommen,
            ausgenommen bei Vorsatz oder grober Fahrlässigkeit sowie bei Verletzung
            von Leben, Körper oder Gesundheit.
          </p>

          <h2>7. Anwendbares Recht</h2>
          <p>
            Es gilt das Recht der Bundesrepublik Deutschland. Fragen? Schreiben Sie
            an <a href="mailto:prasadankur11@gmail.com">prasadankur11@gmail.com</a>.
          </p>

          <p style={{ marginTop: 40 }}>
            <Link to="/datenschutz" className="footer-legal-link">→ Datenschutzerklärung</Link>
          </p>
        </div>
      </section>
      <Footer showInquiry={false} />
    </main>
  );
}
