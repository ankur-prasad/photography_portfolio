import { motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

interface Offer {
  no: string;
  name: string;
  desc: string;
  includes: string[];
  engagement: string;
}

const SERVICES: Offer[] = [
  {
    no: "01",
    name: "Photography",
    desc: "Travel, landscape, architecture and automotive commissions — planned, shot and delivered edit-ready.",
    includes: [
      "Pre-shoot scout, shot list & treatment",
      "Edited, high-resolution, colour-graded files",
      "Commercial usage licence",
    ],
    engagement: "Half-day · full-day · multi-day",
  },
  {
    no: "02",
    name: "Web Experiences",
    desc: "Portfolio and brand sites that feel like this one: smooth, cinematic, engineered from scratch with React, WebGL and motion. No templates.",
    includes: [
      "Art direction, design & front-end build",
      "Custom 3D / WebGL & scroll choreography",
      "Responsive, performance-tuned, deployed",
    ],
    engagement: "Fixed-scope project",
  },
  {
    no: "03",
    name: "AI Consulting",
    desc: "I work full-time as an AI engineer. Strategy, prototyping and hands-on builds — helping teams find where AI actually fits and ship it without the hype.",
    includes: [
      "AI strategy & roadmap",
      "Rapid prototypes & proof-of-concepts",
      "Production integration & shipped features",
    ],
    engagement: "Advisory · project · retainer",
  },
];

const STEPS: { no: string; title: string; body: string }[] = [
  { no: "01", title: "Brief", body: "We talk through what you're making and what it should make people feel. I come back with scope, timeline and a fixed quote." },
  { no: "02", title: "Make", body: "I shoot or build — present in the room or deep in the code. You see progress, not silence." },
  { no: "03", title: "Deliver", body: "Edit-ready files or a deployed experience, on the date we agreed. One round of refinement built in." },
];

export default function Services() {
  return (
    <section className="services" id="services">
      <div className="container">
        <motion.p
          className="eyebrow"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: 0.8, ease: EASE }}
        >
          // Services
        </motion.p>
        <motion.h2
          className="services-title"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10% 0px" }}
          transition={{ duration: 0.9, ease: EASE }}
        >
          Three ways I can help.
        </motion.h2>

        <div className="offer-grid">
          {SERVICES.map((s, i) => (
            <motion.article
              className="offer"
              key={s.no}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-8% 0px" }}
              transition={{ duration: 0.8, delay: i * 0.08, ease: EASE }}
            >
              <span className="offer-no">{s.no}</span>
              <h3 className="offer-name">{s.name}</h3>
              <p className="offer-desc">{s.desc}</p>
              <ul className="offer-includes">
                {s.includes.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
              <span className="offer-engagement">{s.engagement}</span>
            </motion.article>
          ))}
        </div>

        <div className="process">
          <p className="eyebrow">// How it works</p>
          <div className="process-steps">
            {STEPS.map((st, i) => (
              <motion.div
                className="process-step"
                key={st.no}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-8% 0px" }}
                transition={{ duration: 0.8, delay: i * 0.08, ease: EASE }}
              >
                <span className="process-no">{st.no}</span>
                <h4 className="process-title">{st.title}</h4>
                <p className="process-body">{st.body}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="services-cta">
          <p>
            Pricing is project-based. Tell me the budget you&apos;re working with and I&apos;ll
            scope it to fit — no obligation.
          </p>
          <a className="services-cta-btn" href="#contact" data-cursor="email">
            Start a project →
          </a>
        </div>
      </div>
    </section>
  );
}
