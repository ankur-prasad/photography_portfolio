import { supabase } from "./supabase";
import { CONTACT_EMAIL } from "./inquiry";

export type WaitlistResult =
  | { ok: true; via: "supabase" | "mailto" }
  | { ok: false; error: string };

/** Join the pre-Shopify print waitlist. Inserts into Supabase if configured,
 *  else falls back to a prefilled mail draft. */
export async function joinWaitlist(email: string, photo?: string): Promise<WaitlistResult> {
  if (supabase) {
    const { error } = await supabase
      .from("print_waitlist")
      .insert({ email, photo: photo ?? null, source: "prints" });
    if (!error) return { ok: true, via: "supabase" };
    return { ok: false, error: error.message };
  }
  if (typeof window !== "undefined") {
    const body = `Add me to the print waitlist: ${email}${photo ? `\nInterested in: ${photo}` : ""}`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      "Print waitlist"
    )}&body=${encodeURIComponent(body)}`;
  }
  return { ok: true, via: "mailto" };
}
