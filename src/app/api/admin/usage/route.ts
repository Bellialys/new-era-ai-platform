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

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = resolveRequestId(request);

  try {
    const { userId } = await requireAdmin();

    const rl = await checkRateLimit(`admin:${userId}`, 60, 60_000);
    if (rl.limited) {
      logApiRequest("GET", "/api/admin/usage", 429, Date.now() - startTime, requestId);
      return NextResponse.json(
        createErrorResponse(new ApiError(429, "RATE_LIMIT", "Too many requests."), requestId),
        { status: 429 }
      );
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) throw new ApiError(500, "INTERNAL_ERROR", "Database not configured.");

    const now = new Date();
    const todayUtc = new Date(now);
    todayUtc.setUTCHours(0, 0, 0, 0);

    const weekAgoUtc = new Date(todayUtc);
    weekAgoUtc.setUTCDate(weekAgoUtc.getUTCDate() - 7);

    const { data: weekTasks, error } = await supabase
      .from("tasks")
      .select("user_id, created_at")
      .gte("created_at", weekAgoUtc.toISOString())
      .not("user_id", "is", null);

    if (error) throw new ApiError(500, "INTERNAL_ERROR", "Failed to query tasks.");

    const todayIso = todayUtc.toISOString();
    const countsByUser = new Map<string, { today: number; week: number }>();
    for (const row of weekTasks ?? []) {
      const uid = row.user_id as string;
      const counts = countsByUser.get(uid) ?? { today: 0, week: 0 };
      counts.week += 1;
      if (row.created_at >= todayIso) counts.today += 1;
      countsByUser.set(uid, counts);
    }

    if (countsByUser.size === 0) {
      logApiRequest("GET", "/api/admin/usage", 200, Date.now() - startTime, requestId);
      return NextResponse.json({ users: [] });
    }

    const userIds = Array.from(countsByUser.keys());
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, plan")
      .in("id", userIds);

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id as string, p as { id: string; display_name: string | null; plan: string }])
    );

    const result = userIds
      .map((uid) => {
        const counts = countsByUser.get(uid)!;
        const profile = profileMap.get(uid);
        return {
          userId: uid,
          displayName: profile?.display_name ?? null,
          plan: profile?.plan ?? "free",
          requestsToday: counts.today,
          requestsWeek: counts.week,
        };
      })
      .sort((a, b) => b.requestsWeek - a.requestsWeek)
      .slice(0, 50);

    logApiRequest("GET", "/api/admin/usage", 200, Date.now() - startTime, requestId);
    return NextResponse.json({ users: result });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    logApiRequest("GET", "/api/admin/usage", statusCode, Date.now() - startTime, requestId);
    return NextResponse.json(createErrorResponse(error, requestId), { status: statusCode });
  }
}
