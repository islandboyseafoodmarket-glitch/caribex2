import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function getSupabaseClient() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase environment variables are missing");
  }
  client = createClient(url, key);
  return client;
}

/**
 * Lazily creates the browser Supabase client. Keeping initialization behind the
 * proxy prevents Next.js build/prerender phases from requiring runtime secrets.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property: string | symbol) {
    const instance = getSupabaseClient();
    const value = instance[property as keyof SupabaseClient] as unknown;
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
