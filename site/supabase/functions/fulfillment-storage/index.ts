// Admin-only broker for the private `print-originals` Storage bucket.
//
// NOT for public/storefront use — gated by a shared secret
// (X-Fulfillment-Secret header, checked against the FULFILLMENT_ADMIN_SECRET
// Supabase secret), called only from tools/fulfill_order.py when actually
// fulfilling a paid order. verify_jwt=false is deliberate: this uses its own
// auth scheme (the shared secret) rather than a Supabase user session, since
// there is no admin login system on this site.
//
// Actions:
//   POST { action: "upload-url",   path } -> { url, token }  (5 min, for PUT)
//   POST { action: "download-url", path } -> { url }          (48h, for Prodigi to fetch)
//
// Secrets required (Supabase project → Edge Functions → Secrets):
//   FULFILLMENT_ADMIN_SECRET — a long random string, shared with the local
//                              script only. Anyone without it gets 403.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected by Supabase.
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "print-originals";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const expected = Deno.env.get("FULFILLMENT_ADMIN_SECRET");
  const given = req.headers.get("x-fulfillment-secret");
  if (!expected || !given || given !== expected) {
    return json({ error: "Forbidden" }, 403);
  }

  let body: { action?: string; path?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { action, path } = body;
  if (!path || !/^[a-zA-Z0-9/_.-]+$/.test(path)) {
    return json({ error: "Invalid or missing path" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  if (action === "upload-url") {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) return json({ error: error.message }, 500);
    return json({ url: data.signedUrl, token: data.token, path: data.path });
  }

  if (action === "download-url") {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 48);
    if (error) return json({ error: error.message }, 500);
    return json({ url: data.signedUrl });
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});
