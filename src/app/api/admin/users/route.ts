import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  checkRateLimit,
  createErrorResponse,
  logApiRequest,
  requireAdmin,
} from "@/lib/server";
import { getSupabaseServerClient } from "@/lib/server/supabase";
import { resolveRequestId } from "@/lib/server/utils";

type ProfileRow = {
  id: string;
  display_name: string | null;
  role: string;
  plan: string;
};

type AuthUser = {
  id: string;
  email?: string;
  created_at: string;
  last_sign_in_at?: string | null;
};

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = resolveRequestId(request);

  try {
    const { userId } = await requireAdmin();

    const rl = await checkRateLimit(`admin:${userId}`, 60, 60_000);
    if (rl.limited) {
      logApiRequest("GET", "/api/admin/users", 429, Date.now() - startTime, requestId);
      return NextResponse.json(
        createErrorResponse(new ApiError(429, "RATE_LIMIT", "Too many requests."), requestId),
        { status: 429 }
      );
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) throw new ApiError(500, "INTERNAL_ERROR", "Database not configured.");

    const [
      { data: { users: authUsers }, error: authError },
      { data: profilesData, error: profilesError },
    ] = await Promise.all([
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabase.from("profiles").select("id, display_name, role, plan"),
    ]);

    if (authError) throw new ApiError(500, "INTERNAL_ERROR", "Failed to fetch users.");
    if (profilesError) throw new ApiError(500, "INTERNAL_ERROR", "Failed to fetch profiles.");

    const profileMap = new Map<string, ProfileRow>();
    for (const p of (profilesData ?? []) as ProfileRow[]) {
      profileMap.set(p.id, p);
    }

    const users = ((authUsers ?? []) as AuthUser[]).map((u) => {
      const profile = profileMap.get(u.id);
      return {
        id: u.id,
        email: u.email ?? null,
        displayName: profile?.display_name ?? null,
        role: profile?.role ?? "user",
        plan: profile?.plan ?? "free",
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
      };
    });

    logApiRequest("GET", "/api/admin/users", 200, Date.now() - startTime, requestId);
    return NextResponse.json({ status: "success", users });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    logApiRequest("GET", "/api/admin/users", statusCode, Date.now() - startTime, requestId);
    return NextResponse.json(createErrorResponse(error, requestId), { status: statusCode });
  }
}
