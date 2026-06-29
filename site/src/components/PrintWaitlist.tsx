import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { joinWaitlist } from "../lib/waitlist";

export default function PrintWaitlist() {
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState(""); // honeypot
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const valid = /\S+@\S+\.\S+/.test(email);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (hp) return;
    if (!valid || status === "sending") return;
    setStatus("sending");
    const res = await joinWaitlist(email);
    setStatus(res.ok ? "sent" : "error");
  }

  if (status === "sent") {
    return (
      <motion.p
        className="waitlist-sent"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        You&apos;re on the list. I&apos;ll email you the moment prints go live — first access and
        founder pricing.
      </motion.p>
    );
  }

  return (
    <form className="waitlist" onSubmit={onSubmit} noValidate>
      <input
        type="email"
        className="waitlist-input"
        placeholder="you@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        aria-label="Email address"
      />
      <input
        className="inquiry-hp"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
      />
      <button type="submit" className="waitlist-btn" disabled={!valid || status === "sending"}>
        {status === "sending" ? "Adding…" : "Notify me →"}
      </button>
      {status === "error" && (
        <p className="waitlist-err">Couldn&apos;t add you — try again, or email me directly.</p>
      )}
    </form>
  );
}
