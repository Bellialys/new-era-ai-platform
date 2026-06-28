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

type AuditRow = {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = resolveRequestId(request);

  try {
    const { userId } = await requireAdmin();

    const rl = await checkRateLimit(`admin:${userId}`, 60, 60_000);
    if (rl.limited) {
      logApiRequest("GET", "/api/admin/audit", 429, Date.now() - startTime, requestId);
      return NextResponse.json(
        createErrorResponse(new ApiError(429, "RATE_LIMIT", "Too many requests."), requestId),
        { status: 429 }
      );
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) throw new ApiError(500, "INTERNAL_ERROR", "Database not configured.");

    const { data: entries, error } = await supabase
      .from("audit_log")
      .select("id, actor_id, action, target_type, target_id, payload, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new ApiError(500, "INTERNAL_ERROR", "Failed to query audit log.");

    const actorIds = [...new Set(
      (entries ?? []).map((e) => (e as AuditRow).actor_id).filter(Boolean) as string[]
    )];

    const profileMap = new Map<string, string | null>();
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", actorIds);
      for (const p of profiles ?? []) {
        profileMap.set(p.id as string, (p as { id: string; display_name: string | null }).display_name);
      }
    }

    const result = (entries ?? []).map((e) => {
      const row = e as AuditRow;
      return {
        id: row.id,
        actorId: row.actor_id,
        actorName: row.actor_id ? (profileMap.get(row.actor_id) ?? null) : null,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        payload: row.payload,
        createdAt: row.created_at,
      };
    });

    logApiRequest("GET", "/api/admin/audit", 200, Date.now() - startTime, requestId);
    return NextResponse.json({ entries: result });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    logApiRequest("GET", "/api/admin/audit", statusCode, Date.now() - startTime, requestId);
    return NextResponse.json(createErrorResponse(error, requestId), { status: statusCode });
  }
}
