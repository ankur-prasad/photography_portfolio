import { useState, type FormEvent } from "react";
import { joinWaitlist } from "../lib/waitlist";

interface Book {
  id: string;
  title: string;
  blurb: string;
  cover: string; // /web path — rendered from /mid
}

// First two volumes — heavy coverage in the archive. Photo curation pending;
// notify signups land in the print_waitlist table with the book id.
const BOOKS: Book[] = [
  {
    id: "BOOK-TURKIYE",
    title: "Türkiye",
    blurb: "Fairy chimneys, minarets and travertine — Cappadocia to the coast.",
    cover: "/web/ANK03010.jpg",
  },
  {
    id: "BOOK-AMERICAN-WEST",
    title: "The American West",
    blurb: "Canyons, white sands and empty desert two-lanes.",
    cover: "/web/ANK09500.jpg",
  },
];

function BookCard({ book }: { book: Book }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const valid = /\S+@\S+\.\S+/.test(email);

  async function notify(e: FormEvent) {
    e.preventDefault();
    if (!valid || status === "sending") return;
    setStatus("sending");
    const res = await joinWaitlist(email, book.id);
    setStatus(res.ok ? "sent" : "error");
  }

  return (
    <article className="book-card">
      <div className="book-cover">
        <img src={book.cover.replace("/web/", "/mid/")} alt={`${book.title} — photo book cover`} loading="lazy" />
        <span className="book-spine" aria-hidden />
      </div>
      <div className="book-info">
        <h3 className="book-title">{book.title}</h3>
        <p className="book-blurb">{book.blurb}</p>
        <p className="book-status">Hardcover photo book — in curation</p>
        {status === "sent" ? (
          <p className="book-sent">You&apos;ll be first to know when it&apos;s ready.</p>
        ) : (
          <form className="book-notify" onSubmit={notify} noValidate>
            <input
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label={`Get notified when ${book.title} is released`}
            />
            <button type="submit" disabled={!valid || status === "sending"}>
              {status === "sending" ? "…" : "Notify me"}
            </button>
            {status === "error" && <span className="book-err">Try again?</span>}
          </form>
        )}
      </div>
    </article>
  );
}

export default function BooksTeaser() {
  return (
    <section className="books">
      <div className="container">
        <p className="eyebrow">// In the making</p>
        <h2 className="books-title">Travel books.</h2>
        <p className="books-lede">
          The journeys with the deepest archives, curated into printed volumes — every spread
          shot, sequenced and told by me.
        </p>
        <div className="books-grid">
          {BOOKS.map((b) => (
            <BookCard key={b.id} book={b} />
          ))}
        </div>
      </div>
    </section>
  );
}
