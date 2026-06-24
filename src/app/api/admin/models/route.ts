import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  createErrorResponse,
  logApiRequest,
  requireAdmin,
} from "@/lib/server";
import { getSupabaseServerClient } from "@/lib/server/supabase";
import { badgeFromTags } from "@/lib/server/model-catalog";
import { resolveRequestId } from "@/lib/server/utils";

type ModelRow = {
  id: string;
  display_name: string;
  model_key: string;
  role_tags: string[] | null;
  price_label: string | null;
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
    await requireAdmin();

    const supabase = getSupabaseServerClient();
    if (!supabase) throw new ApiError(500, "INTERNAL_ERROR", "Database not configured.");

    const [{ data: modelsData, error: modelsError }, { data: responsesData }] = await Promise.all([
      supabase
        .from("models")
        .select("id, display_name, model_key, role_tags, price_label, is_active, access_level")
        .order("display_name"),
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

    const models = ((modelsData ?? []) as ModelRow[]).map((m) => {
      const badge = badgeFromTags(m.role_tags, m.price_label);
      return {
        id: m.id,
        name: m.display_name,
        model_key: m.model_key,
        badge: badge ? [badge] : [],
        is_active: m.is_active,
        access_level: m.access_level ?? "registered",
        totalResponses: responsesByModel.get(m.id) ?? 0,
      };
    });

    logApiRequest("GET", "/api/admin/models", 200, Date.now() - startTime, requestId);
    return NextResponse.json({ status: "success", models });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    logApiRequest("GET", "/api/admin/models", statusCode, Date.now() - startTime, requestId);
    return NextResponse.json(createErrorResponse(error, requestId), { status: statusCode });
  }
}
