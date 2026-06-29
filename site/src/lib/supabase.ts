import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Anon/publishable key is safe to ship in the client — it's protected by
// row-level security (the inquiries table is insert-only for anon, never readable).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null;
