import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  createErrorResponse,
  logApiRequest,
  requireAdmin,
} from "@/lib/server";
import { getSupabaseServerClient } from "@/lib/server/supabase";
import { resolveRequestId } from "@/lib/server/utils";

const VALID_ROLES = ["user", "admin"] as const;
const VALID_PLANS = ["free", "pro"] as const;
type UserRole = (typeof VALID_ROLES)[number];
type UserPlan = (typeof VALID_PLANS)[number];

interface PatchBody {
  role?: unknown;
  plan?: unknown;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const requestId = resolveRequestId(request);
  const { id } = await params;

  try {
    await requireAdmin();

    const supabase = getSupabaseServerClient();
    if (!supabase) throw new ApiError(500, "INTERNAL_ERROR", "Database not configured.");

    let body: PatchBody;
    try {
      body = (await request.json()) as PatchBody;
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    const updates: Record<string, string> = {};

    if ("role" in body) {
      if (!VALID_ROLES.includes(body.role as UserRole)) {
        throw new ApiError(400, "VALIDATION_ERROR", `role must be one of: ${VALID_ROLES.join(", ")}.`);
      }
      updates["role"] = body.role as string;
    }

    if ("plan" in body) {
      if (!VALID_PLANS.includes(body.plan as UserPlan)) {
        throw new ApiError(400, "VALIDATION_ERROR", `plan must be one of: ${VALID_PLANS.join(", ")}.`);
      }
      updates["plan"] = body.plan as string;
    }

    if (Object.keys(updates).length === 0) {
      throw new ApiError(400, "VALIDATION_ERROR", "No valid fields to update.");
    }

    const { error } = await supabase.from("profiles").update(updates).eq("id", id);

    if (error) {
      console.error("Admin user update error:", error);
      throw new ApiError(500, "INTERNAL_ERROR", "Failed to update user.");
    }

    logApiRequest("PATCH", `/api/admin/users/${id}`, 200, Date.now() - startTime, requestId);
    return NextResponse.json({ status: "success" });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    logApiRequest("PATCH", `/api/admin/users/${id}`, statusCode, Date.now() - startTime, requestId);
    return NextResponse.json(createErrorResponse(error, requestId), { status: statusCode });
  }
}
