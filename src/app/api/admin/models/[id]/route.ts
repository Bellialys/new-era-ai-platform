import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  checkAdminMutationRateLimit,
  createErrorResponse,
  logApiRequest,
  requireAdmin,
} from "@/lib/server";
import { getSupabaseServerClient } from "@/lib/server/supabase";
import { resolveRequestId } from "@/lib/server/utils";

const VALID_ACCESS_LEVELS = ["anonymous", "registered", "premium"] as const;
type AccessLevel = (typeof VALID_ACCESS_LEVELS)[number];

interface PatchBody {
  is_active?: unknown;
  name?: unknown;
  access_level?: unknown;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const requestId = resolveRequestId(request);
  const { id } = await params;

  try {
    const { userId: actorId } = await requireAdmin();

    const rateLimit = await checkAdminMutationRateLimit(actorId, "models.patch");
    if (rateLimit.limited) {
      logApiRequest("PATCH", `/api/admin/models/${id}`, 429, Date.now() - startTime, requestId);
      return NextResponse.json(
        createErrorResponse(new ApiError(429, "RATE_LIMIT", "Too many admin mutation requests."), requestId),
        {
          status: 429,
          headers: {
            "Retry-After": Math.max(
              Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
              1
            ).toString(),
          },
        }
      );
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) throw new ApiError(500, "INTERNAL_ERROR", "Database not configured.");

    let body: PatchBody;
    try {
      body = (await request.json()) as PatchBody;
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    const updates: Record<string, unknown> = {};

    if ("is_active" in body) {
      if (typeof body.is_active !== "boolean") {
        throw new ApiError(400, "VALIDATION_ERROR", "is_active must be a boolean.");
      }
      updates["is_active"] = body.is_active;
    }

    if ("name" in body) {
      const v = typeof body.name === "string" ? body.name.trim() : null;
      if (!v || v.length > 100) {
        throw new ApiError(400, "VALIDATION_ERROR", "name must be a non-empty string (max 100 chars).");
      }
      updates["display_name"] = v;
    }

    if ("access_level" in body) {
      if (!VALID_ACCESS_LEVELS.includes(body.access_level as AccessLevel)) {
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          `access_level must be one of: ${VALID_ACCESS_LEVELS.join(", ")}.`
        );
      }
      updates["access_level"] = body.access_level;
    }

    if (Object.keys(updates).length === 0) {
      throw new ApiError(400, "VALIDATION_ERROR", "No valid fields to update.");
    }

    const { error } = await supabase.rpc("admin_update_model_with_audit", {
      p_actor_id: actorId,
      p_target_id: id,
      p_updates: updates,
    });

    if (error) {
      if (error.message === "ADMIN_AUTH_REQUIRED") {
        throw new ApiError(403, "FORBIDDEN", "Admin access required.");
      }
      if (error.message === "MODEL_NOT_FOUND") {
        throw new ApiError(404, "MODEL_NOT_FOUND", "Model was not found.");
      }
      console.error("Admin model mutation RPC error:", error.code ?? "unknown");
      throw new ApiError(500, "INTERNAL_ERROR", "Failed to update model.");
    }

    logApiRequest("PATCH", `/api/admin/models/${id}`, 200, Date.now() - startTime, requestId);
    return NextResponse.json({ status: "success" });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    logApiRequest("PATCH", `/api/admin/models/${id}`, statusCode, Date.now() - startTime, requestId);
    return NextResponse.json(createErrorResponse(error, requestId), { status: statusCode });
  }
}
