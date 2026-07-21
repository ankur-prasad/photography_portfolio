// Creates a Stripe Checkout Session for a print order and returns its URL.
//
// Public endpoint (verify_jwt=false): called anonymously from the /prints
// shop, same trust model as the existing inquiries/print_waitlist inserts —
// there is no Supabase user session for a storefront visitor. Price is never
// trusted from the client: the SKU is looked up in the bundled print catalog
// (deployed alongside this function) to get the authoritative retail price.
//
// Secrets required (Supabase project → Edge Functions → Secrets):
//   STRIPE_RESTRICTED_KEY  — rk_test_/rk_live_..., scoped to Checkout
//                            Sessions: Write (+ whatever Stripe defaults on).
import catalog from "./print-catalog.json" with { type: "json" };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function findSku(sku: string) {
  for (const finish of catalog.finishes) {
    const size = finish.sizes.find((s: { sku: string }) => s.sku === sku);
    if (size) return { finish, size };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const stripeKey = Deno.env.get("STRIPE_RESTRICTED_KEY");
  if (!stripeKey) return json({ error: "Stripe not configured" }, 500);

  let body: {
    photo?: string; sku?: string; title?: string; color?: string; option?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { photo, sku, title, color, option } = body;
  if (!photo || !sku) return json({ error: "photo and sku are required" }, 400);

  const match = findSku(sku);
  if (!match) return json({ error: `Unknown SKU: ${sku}` }, 400);
  const { finish, size } = match;

  const origin = req.headers.get("origin") || "https://your-domain.com";
  const productName = `${finish.label} — ${size.label}${color ? ` (${color})` : ""}`;
  const description = [title, option].filter(Boolean).join(" · ");

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("payment_method_types[0]", "card");
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "eur");
  params.set("line_items[0][price_data][unit_amount]", String(Math.round(size.retailEUR * 100)));
  params.set("line_items[0][price_data][product_data][name]", productName);
  if (description) params.set("line_items[0][price_data][product_data][description]", description);
  params.set("line_items[0][price_data][product_data][images][0]", `${origin}/mid/${photo}.jpg`);
  params.set("success_url", `${origin}/prints?order=success&session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${origin}/prints?photo=${encodeURIComponent(photo)}`);
  // Only offer countries Prodigi has actually confirmed deliverable for THIS
  // finish (tools/check_country_availability.py probes /quotes per finish and
  // bakes the result into the bundled catalog) — never a guessed static list.
  const countries: string[] = finish.countries?.length ? finish.countries : ["DE", "US", "GB"];
  countries.forEach((c, i) => params.set(`shipping_address_collection[allowed_countries][${i}]`, c));
  params.set("metadata[photo]", photo);
  params.set("metadata[sku]", sku);
  params.set("metadata[finish]", finish.label);
  params.set("metadata[size]", size.label);
  if (color) params.set("metadata[color]", color);
  if (option) params.set("metadata[option]", option);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${stripeKey}:`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const session = await res.json();
  if (!res.ok) {
    console.error("[stripe]", session);
    return json({ error: session?.error?.message ?? "Stripe request failed" }, 502);
  }
  return json({ url: session.url });
});
