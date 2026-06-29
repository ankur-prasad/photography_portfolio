import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

const FAQS: { q: string; a: string }[] = [
  {
    q: "Do you travel for shoots?",
    a: "Yes — travel and location work is most of what I do. Based in Munich, I shoot across the Alps and fly for the right brief. Travel and logistics are folded into the quote up front, no surprises.",
  },
  {
    q: "How soon can you start?",
    a: "Usually within a few weeks, sometimes sooner for tight windows. Tell me your timeline in the form and I'll tell you honestly whether I can hit it.",
  },
  {
    q: "Can I licence images for commercial use?",
    a: "Every commission includes a commercial usage licence scoped to your need — web, print, campaign. If you need exclusivity or a buyout, say so and I'll price it in.",
  },
  {
    q: "Do you build sites remotely?",
    a: "Always. Web and AI consulting work is fully remote, anywhere in the world. You work directly with me start to finish — the person who designed and built this site is the person who'll build yours.",
  },
  {
    q: "What does a project cost?",
    a: "It's project-based and scoped to fit your budget. Share the range you're working with in the form — I'd rather shape something that works for you than quote blind.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="faq">
      <div className="container">
        <p className="eyebrow">// Questions</p>
        <div className="faq-list">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div className={isOpen ? "faq-item open" : "faq-item"} key={f.q}>
                <button
                  className="faq-q"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span>{f.q}</span>
                  <span className="faq-sign">{isOpen ? "−" : "+"}</span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      className="faq-a-wrap"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: EASE }}
                    >
                      <p className="faq-a">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
