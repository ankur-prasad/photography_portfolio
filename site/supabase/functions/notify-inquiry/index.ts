import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/* Fires on new rows in public.inquiries / public.print_waitlist (pg_net
 * trigger — see supabase/notify_trigger.sql). Sends an email via Resend
 * and/or a Telegram message — each channel activates only when its secret
 * is configured:
 *   RESEND_API_KEY  + optional NOTIFY_TO / NOTIFY_FROM
 *   TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
 * Optional NOTIFY_SECRET: when set, requests must carry the matching
 * x-notify-secret header (the DB trigger sends it). */

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

Deno.serve(async (req: Request) => {
  const secret = Deno.env.get("NOTIFY_SECRET");
  if (secret && req.headers.get("x-notify-secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }

  let row: Record<string, unknown>;
  try {
    row = await req.json();
  } catch {
    return new Response("bad payload", { status: 400 });
  }

  const table = String(row._table ?? "inquiries");
  const isWaitlist = table === "print_waitlist";
  const subject = isWaitlist
    ? `Print waitlist signup: ${row.email ?? "?"}`
    : `New inquiry: ${row.name ?? "?"} — ${row.project_type ?? row.projectType ?? "?"}`;

  const lines = Object.entries(row)
    .filter(([k]) => !k.startsWith("_"))
    .map(([k, v]) => `${k}: ${v ?? ""}`)
    .join("\n");

  const results: Record<string, string> = {};

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (resendKey) {
    const to = Deno.env.get("NOTIFY_TO") ?? "prasadankur11@gmail.com";
    const from = Deno.env.get("NOTIFY_FROM") ?? "onboarding@resend.dev";
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html: `<pre style="font-family:monospace">${esc(lines)}</pre>`,
      }),
    });
    results.email = r.ok ? "sent" : `error ${r.status}: ${await r.text()}`;
  }

  const tgToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const tgChat = Deno.env.get("TELEGRAM_CHAT_ID");
  if (tgToken && tgChat) {
    const r = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: tgChat, text: `\u{1F4EC} ${subject}\n\n${lines}` }),
    });
    results.telegram = r.ok ? "sent" : `error ${r.status}`;
  }

  if (!resendKey && !(tgToken && tgChat)) {
    console.log("notify-inquiry: no channel configured, payload:", subject);
    results.none = "no channels configured — set RESEND_API_KEY or TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID";
  }

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
});
