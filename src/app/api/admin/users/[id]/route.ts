import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  checkAdminMutationRateLimit,
  createErrorResponse,
  logApiRequest,
  requireAdmin,
  logAuditEvent,
} from "@/lib/server";
import { getSupabaseServerClient } from "@/lib/server/supabase";
import { resolveRequestId } from "@/lib/server/utils";

const VALID_ROLES = ["user", "admin"] as const;
const VALID_PLANS = ["free", "pro"] as const;
type UserRole = (typeof VALID_ROLES)[number];
type UserPlan = (typeof VALID_PLANS)[number];

type ProfileBeforeUpdate = {
  role: string;
  plan: string;
};

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
    const { userId: actorId } = await requireAdmin();

    const rateLimit = await checkAdminMutationRateLimit(actorId, "users.patch");
    if (rateLimit.limited) {
      logApiRequest("PATCH", `/api/admin/users/${id}`, 429, Date.now() - startTime, requestId);
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

    const { data: before, error: beforeError } = await supabase
      .from("profiles")
      .select("role, plan")
      .eq("id", id)
      .maybeSingle();

    if (beforeError) {
      console.error("Admin user lookup error:", beforeError);
      throw new ApiError(500, "INTERNAL_ERROR", "Failed to fetch user.");
    }

    if (!before) {
      throw new ApiError(404, "USER_NOT_FOUND", "User was not found.");
    }

    await assertAdminRoleTransitionAllowed({
      actorId,
      targetId: id,
      before: before as ProfileBeforeUpdate,
      updates,
      supabase,
    });

    const { error } = await supabase.from("profiles").update(updates).eq("id", id);

    if (error) {
      console.error("Admin user update error:", error);
      throw new ApiError(500, "INTERNAL_ERROR", "Failed to update user.");
    }

    const action = "role" in updates ? "user.role_change" : "user.plan_change";
    await logAuditEvent({
      actorId: actorId,
      action,
      targetType: "user",
      targetId: id,
      payload: { before: before ?? null, after: updates },
    });

    logApiRequest("PATCH", `/api/admin/users/${id}`, 200, Date.now() - startTime, requestId);
    return NextResponse.json({ status: "success" });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    logApiRequest("PATCH", `/api/admin/users/${id}`, statusCode, Date.now() - startTime, requestId);
    return NextResponse.json(createErrorResponse(error, requestId), { status: statusCode });
  }
}

async function assertAdminRoleTransitionAllowed({
  actorId,
  targetId,
  before,
  updates,
  supabase,
}: {
  actorId: string;
  targetId: string;
  before: ProfileBeforeUpdate;
  updates: Record<string, string>;
  supabase: ReturnType<typeof getSupabaseServerClient>;
}) {
  if (updates["role"] !== "user" || before.role !== "admin") {
    return;
  }

  if (targetId === actorId) {
    throw new ApiError(409, "ADMIN_SELF_DEMOTION", "Admins cannot demote their own account.");
  }

  if (!supabase) {
    throw new ApiError(500, "INTERNAL_ERROR", "Database not configured.");
  }

  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");

  if (error) {
    console.error("Admin count lookup error:", error);
    throw new ApiError(500, "INTERNAL_ERROR", "Failed to verify admin role safety.");
  }

  if ((count ?? 0) <= 1) {
    throw new ApiError(409, "ADMIN_LAST_ADMIN", "Cannot demote the final admin account.");
  }
}
