// Inquiry submission — backend-agnostic, in priority order:
//   1. Supabase (if VITE_SUPABASE_URL/ANON_KEY are set) — insert into `inquiries`.
//   2. A generic POST endpoint (VITE_INQUIRY_ENDPOINT) — Formspree/Web3Forms/etc.
//   3. A prefilled mail draft to CONTACT_EMAIL — so the form always works.

import { supabase } from "./supabase";

export const CONTACT_EMAIL = "prasadankur11@gmail.com";

export interface Inquiry {
  name: string;
  email: string;
  projectType: string;
  budget: string;
  timeline: string;
  message: string;
}

const ENDPOINT = import.meta.env.VITE_INQUIRY_ENDPOINT as string | undefined;

export type SubmitResult =
  | { ok: true; via: "supabase" | "endpoint" | "mailto" }
  | { ok: false; error: string };

function mailtoFallback(data: Inquiry): SubmitResult {
  const subject = `New inquiry — ${data.projectType || "Project"} (${data.name})`;
  const body = [
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Project: ${data.projectType}`,
    `Budget: ${data.budget}`,
    `Timeline: ${data.timeline}`,
    "",
    data.message,
  ].join("\n");
  const href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
  if (typeof window !== "undefined") window.location.href = href;
  return { ok: true, via: "mailto" };
}

export async function submitInquiry(data: Inquiry): Promise<SubmitResult> {
  // 1. Supabase
  if (supabase) {
    const { error } = await supabase.from("inquiries").insert({
      name: data.name,
      email: data.email,
      project_type: data.projectType,
      budget: data.budget,
      timeline: data.timeline,
      message: data.message,
      source: "portfolio",
    });
    if (!error) return { ok: true, via: "supabase" };
    return { ok: false, error: error.message };
  }

  // 2. Generic endpoint
  if (!ENDPOINT) return mailtoFallback(data);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        ...data,
        _subject: `New inquiry — ${data.projectType} (${data.name})`,
        source: "portfolio",
      }),
    });
    if (!res.ok) return { ok: false, error: `Request failed (${res.status})` };
    return { ok: true, via: "endpoint" };
  } catch {
    // Network/endpoint down — degrade to mail draft rather than losing the lead.
    return mailtoFallback(data);
  }
}
