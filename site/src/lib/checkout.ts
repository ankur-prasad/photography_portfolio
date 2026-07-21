import { supabase } from "./supabase";

export interface CheckoutSpec {
  photo: string;
  sku: string;
  title?: string;
  color?: string;
  option?: string;
}

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

/** Creates a Stripe Checkout session for a print via the create-checkout-session
 *  edge function and returns the hosted checkout URL to redirect to. */
export async function createCheckout(spec: CheckoutSpec): Promise<CheckoutResult> {
  if (!supabase) return { ok: false, error: "Checkout not configured" };
  const { data, error } = await supabase.functions.invoke("create-checkout-session", {
    body: spec,
  });
  if (error) return { ok: false, error: error.message };
  if (!data?.url) return { ok: false, error: "No checkout URL returned" };
  return { ok: true, url: data.url };
}
