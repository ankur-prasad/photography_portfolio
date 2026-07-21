// Stripe payment webhook: verifies the signature, then records the paid order
// in `orders` (status='paid'). Deliberately does NOT place a Prodigi order —
// that is a separate, explicit step (real money, real manufacturing/shipping)
// gated on the site owner's go-ahead, not automated here.
//
// verify_jwt=false is REQUIRED: Stripe calls this directly and cannot send a
// Supabase auth JWT. Authenticity is instead verified via the Stripe-Signature
// header (HMAC-SHA256 over the raw body with the webhook signing secret) —
// this function checks that signature itself, so it is not unauthenticated.
//
// Secrets required (Supabase project → Edge Functions → Secrets):
//   STRIPE_WEBHOOK_SECRET  — whsec_..., from the Stripe webhook endpoint
//                            created for this function's URL.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected by Supabase.
import { createClient } from "jsr:@supabase/supabase-js@2";

async function verifyStripeSignature(payload: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)
  );
  const expected = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");

  // constant-time compare
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return new Response("Not configured", { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  const payload = await req.text();
  if (!sig || !(await verifyStripeSignature(payload, sig, webhookSecret))) {
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(payload);
  if (event.type !== "checkout.session.completed") {
    return new Response("ignored", { status: 200 });
  }

  const session = event.data.object;
  const md = session.metadata ?? {};
  const shipping = session.shipping_details ?? session.customer_details;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { error } = await supabase.from("orders").upsert({
    stripe_session_id: session.id,
    stripe_payment_intent: session.payment_intent,
    customer_email: session.customer_details?.email ?? null,
    amount_total_cents: session.amount_total,
    currency: session.currency,
    photo: md.photo ?? "unknown",
    sku: md.sku ?? "unknown",
    size_label: md.size ?? null,
    finish_label: md.finish ?? null,
    color: md.color ?? null,
    option_value: md.option ?? null,
    shipping_name: shipping?.name ?? null,
    shipping_address: shipping?.address ?? null,
    status: "paid",
  }, { onConflict: "stripe_session_id" });

  if (error) {
    console.error("[orders insert]", error);
    return new Response("DB error", { status: 500 });
  }
  return new Response("ok", { status: 200 });
});
