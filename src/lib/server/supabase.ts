import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "./utils";

let cachedClient: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl && !publishableKey) {
    return null;
  }

  if (!supabaseUrl || !publishableKey) {
    throw new ApiError(
      500,
      "DATABASE_NOT_CONFIGURED",
      "Database is not configured. Please contact the project owner."
    );
  }

  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, publishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return cachedClient;
}
