import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
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
    await requireAdmin();

    const supabase = getSupabaseServerClient();
    if (!supabase) throw new ApiError(500, "INTERNAL_ERROR", "Database not configured.");

    const [
      { count: totalUsers },
      { count: totalTasks },
      { count: totalVotes },
      { count: totalModels },
      { count: activeModels },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("tasks").select("*", { count: "exact", head: true }),
      supabase.from("votes").select("*", { count: "exact", head: true }),
      supabase.from("models").select("*", { count: "exact", head: true }),
      supabase.from("models").select("*", { count: "exact", head: true }).eq("is_active", true),
    ]);

    logApiRequest("GET", "/api/admin/stats", 200, Date.now() - startTime, requestId);

    return NextResponse.json({
      status: "success",
      totalUsers: totalUsers ?? 0,
      totalTasks: totalTasks ?? 0,
      totalVotes: totalVotes ?? 0,
      totalModels: totalModels ?? 0,
      activeModels: activeModels ?? 0,
    });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    logApiRequest("GET", "/api/admin/stats", statusCode, Date.now() - startTime, requestId);
    return NextResponse.json(createErrorResponse(error, requestId), { status: statusCode });
  }
}
