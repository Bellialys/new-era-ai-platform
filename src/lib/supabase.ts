import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client (uses the public publishable key only).
 *
 * Built on @supabase/ssr so the auth session is stored in cookies that the
 * server (middleware + route handlers) can read. This is what lets the backend
 * verify the current user instead of trusting client-supplied ids.
 *
 * Returns null when Supabase is not configured so the UI can keep working
 * without auth instead of throwing. This mirrors the server client in
 * src/lib/server/supabase.ts.
 */
let cachedClient: SupabaseClient | null = null;

function readBrowserConfig(): { url: string; key: string } | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    return null;
  }

  return { url: supabaseUrl, key: supabasePublishableKey };
}

export function getSupabaseClient(): SupabaseClient | null {
  const config = readBrowserConfig();
  if (!config) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createBrowserClient(config.url, config.key);
  }

  return cachedClient;
}

export function isSupabaseConfigured(): boolean {
  return readBrowserConfig() !== null;
}
