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

type ModelRow = {
  id: string;
  name: string;
  model_key: string;
  badge: unknown;
  is_active: boolean;
  access_level: string;
};

type ResponseRow = {
  model_id: string | null;
};

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = resolveRequestId(request);

  try {
    const { userId } = await requireAdmin();

    const rl = await checkRateLimit(`admin:${userId}`, 60, 60_000);
    if (rl.limited) {
      logApiRequest("GET", "/api/admin/models", 429, Date.now() - startTime, requestId);
      return NextResponse.json(
        createErrorResponse(new ApiError(429, "RATE_LIMIT", "Too many requests."), requestId),
        { status: 429 }
      );
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) throw new ApiError(500, "INTERNAL_ERROR", "Database not configured.");

    const [{ data: modelsData, error: modelsError }, { data: responsesData }] = await Promise.all([
      supabase.from("models").select("id, name, model_key, badge, is_active, access_level").order("name"),
      supabase.from("model_responses").select("model_id"),
    ]);

    if (modelsError) {
      throw new ApiError(500, "INTERNAL_ERROR", "Failed to fetch models.");
    }

    const responsesByModel = new Map<string, number>();
    for (const row of (responsesData ?? []) as ResponseRow[]) {
      if (!row.model_id) continue;
      responsesByModel.set(row.model_id, (responsesByModel.get(row.model_id) ?? 0) + 1);
    }

    const models = ((modelsData ?? []) as ModelRow[]).map((m) => ({
      id: m.id,
      name: m.name,
      model_key: m.model_key,
      badge: Array.isArray(m.badge)
        ? (m.badge as unknown[]).filter((b): b is string => typeof b === "string")
        : [],
      is_active: m.is_active,
      access_level: m.access_level ?? "registered",
      totalResponses: responsesByModel.get(m.id) ?? 0,
    }));

    logApiRequest("GET", "/api/admin/models", 200, Date.now() - startTime, requestId);
    return NextResponse.json({ status: "success", models });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    logApiRequest("GET", "/api/admin/models", statusCode, Date.now() - startTime, requestId);
    return NextResponse.json(createErrorResponse(error, requestId), { status: statusCode });
  }
}
