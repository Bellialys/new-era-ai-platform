import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  ADMIN_MUTATION_RATE_LIMIT_MAX_REQUESTS,
  ADMIN_MUTATION_RATE_LIMIT_WINDOW_MS,
} from "@/lib/arena/constants";
import { checkRateLimit } from "./rate-limit";
import { ApiError } from "./utils";
import { getSupabaseServerClient } from "./supabase";

function readPublicSupabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

/**
 * Verifies the current request comes from a user with role = 'admin'.
 * Works in both Server Components and Route Handlers (reads cookies via next/headers).
 * Throws ApiError(403) if not authenticated or not admin.
 */
export async function requireAdmin(): Promise<{ userId: string }> {
  const config = readPublicSupabaseConfig();
  if (!config) {
    throw new ApiError(403, "FORBIDDEN", "Admin access required");
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Read-only — token refresh is handled by the proxy.
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new ApiError(403, "FORBIDDEN", "Admin access required");
  }

  const userId = data.user.id;

  const serviceClient = getSupabaseServerClient();
  if (!serviceClient) {
    throw new ApiError(500, "INTERNAL_ERROR", "Database not configured.");
  }

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profileError || !profile || (profile as { role: string }).role !== "admin") {
    throw new ApiError(403, "FORBIDDEN", "Admin access required");
  }

  return { userId };
}

export async function checkAdminMutationRateLimit(actorId: string, scope: string) {
  return checkRateLimit(
    `admin:mutation:${scope}:${actorId}`,
    ADMIN_MUTATION_RATE_LIMIT_MAX_REQUESTS,
    ADMIN_MUTATION_RATE_LIMIT_WINDOW_MS
  );
}
