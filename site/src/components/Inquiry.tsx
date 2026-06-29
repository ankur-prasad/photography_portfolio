import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { submitInquiry, CONTACT_EMAIL, type Inquiry as InquiryData } from "../lib/inquiry";

const PROJECT_TYPES = ["Photography", "Web experience", "AI consulting", "Something else"];
const BUDGETS = ["< €2k", "€2k–5k", "€5k–15k", "€15k+", "Not sure yet"];
const TIMELINES = ["ASAP", "1–3 months", "Flexible", "Just exploring"];

// Edit these as your availability changes.
const TRUST = [
  { k: "Availability", v: "Booking Q3 2026" },
  { k: "Reply time", v: "Within 24 hours" },
  { k: "Who you get", v: "Me, directly — no agency" },
  { k: "Based in", v: "Munich · remote worldwide" },
];

const EASE = [0.16, 1, 0.3, 1] as const;
const empty: InquiryData = { name: "", email: "", projectType: "", budget: "", timeline: "", message: "" };

export default function Inquiry() {
  const [data, setData] = useState<InquiryData>(empty);
  const [hp, setHp] = useState(""); // honeypot — bots fill this, humans never see it
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const set = (k: keyof InquiryData, v: string) => setData((d) => ({ ...d, [k]: v }));
  const valid = data.name.trim() && /\S+@\S+\.\S+/.test(data.email) && data.projectType && data.message.trim();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (hp) return; // bot
    if (!valid || status === "sending") return;
    setStatus("sending");
    setError("");
    const res = await submitInquiry(data);
    if (res.ok) {
      setStatus("sent");
    } else {
      setStatus("error");
      setError(res.error);
    }
  }

  return (
    <section className="contact inquiry" id="contact">
      <div className="container">
        <p className="contact-kicker">// Work with me</p>

        <AnimatePresence mode="wait">
          {status === "sent" ? (
            <motion.div
              key="sent"
              className="inquiry-sent"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
            >
              <h2>Got it.</h2>
              <p>
                Your brief landed. I read every inquiry myself and reply within 24 hours —
                usually with a few questions to sharpen the scope.
              </p>
              <button className="inquiry-reset" onClick={() => { setData(empty); setStatus("idle"); }}>
                Send another →
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h2 className="inquiry-head">
                Let&apos;s build the frame for it.
              </h2>
              <p className="inquiry-lede">
                Photography commissions, brand sites and AI consulting. Tell me what you&apos;re
                working on — the more context, the sharper my reply.
              </p>

              <dl className="inquiry-trust">
                {TRUST.map((t) => (
                  <div key={t.k}>
                    <dt>{t.k}</dt>
                    <dd>{t.v}</dd>
                  </div>
                ))}
              </dl>

              <form className="inquiry-form" onSubmit={onSubmit} noValidate>
                <div className="inquiry-row">
                  <label className="inquiry-field">
                    <span>Your name</span>
                    <input
                      type="text"
                      value={data.name}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder="Jane Doe"
                      autoComplete="name"
                    />
                  </label>
                  <label className="inquiry-field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={data.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="jane@studio.com"
                      autoComplete="email"
                    />
                  </label>
                </div>

                <fieldset className="inquiry-chips">
                  <legend>What do you need?</legend>
                  <div className="chip-row">
                    {PROJECT_TYPES.map((t) => (
                      <button
                        type="button"
                        key={t}
                        className={data.projectType === t ? "chip active" : "chip"}
                        onClick={() => set("projectType", t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="inquiry-row">
                  <label className="inquiry-field">
                    <span>Budget</span>
                    <div className="chip-row tight">
                      {BUDGETS.map((b) => (
                        <button
                          type="button"
                          key={b}
                          className={data.budget === b ? "chip sm active" : "chip sm"}
                          onClick={() => set("budget", b)}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </label>
                </div>

                <div className="inquiry-row">
                  <label className="inquiry-field">
                    <span>Timeline</span>
                    <div className="chip-row tight">
                      {TIMELINES.map((t) => (
                        <button
                          type="button"
                          key={t}
                          className={data.timeline === t ? "chip sm active" : "chip sm"}
                          onClick={() => set("timeline", t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </label>
                </div>

                <label className="inquiry-field">
                  <span>The brief</span>
                  <textarea
                    rows={4}
                    value={data.message}
                    onChange={(e) => set("message", e.target.value)}
                    placeholder="What are we making, and what should it make people feel?"
                  />
                </label>

                {/* honeypot — visually hidden, not announced to AT */}
                <input
                  className="inquiry-hp"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  value={hp}
                  onChange={(e) => setHp(e.target.value)}
                />

                <div className="inquiry-actions">
                  <button type="submit" className="inquiry-submit" disabled={!valid || status === "sending"}>
                    {status === "sending" ? "Sending…" : "Send the brief →"}
                  </button>
                  <span className="inquiry-or">
                    or just email <a href={`mailto:${CONTACT_EMAIL}`} data-cursor="email">{CONTACT_EMAIL}</a>
                  </span>
                </div>
                {status === "error" && (
                  <p className="inquiry-error">
                    Couldn&apos;t send that — try again, or email me directly. {error}
                  </p>
                )}
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
