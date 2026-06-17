/**
 * GET  /api/profile — read current user's profile
 * PATCH /api/profile — update display_name, first_name, last_name
 *
 * Requires an authenticated session.
 */
import { NextRequest, NextResponse } from "next/server";
import { createErrorResponse, logApiRequest, ApiError, getAuthenticatedUserId } from "@/lib/server";
import { getSupabaseServerClient } from "@/lib/server/supabase";

interface ProfileResponse {
  status: "success";
  profile: {
    id: string;
    email: string | null;
    displayName: string | null;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
    role: string;
    plan: string;
    createdAt: string;
    updatedAt: string;
  };
}

interface PatchBody {
  displayName?: unknown;
  firstName?: unknown;
  lastName?: unknown;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      logApiRequest("GET", "/api/profile", 401, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(new ApiError(401, "AUTH_REQUIRED", "Sign in to view your profile.")),
        { status: 401 }
      );
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) throw new ApiError(500, "INTERNAL_ERROR", "Database not configured.");

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, display_name, first_name, last_name, avatar_url, role, plan, created_at, updated_at")
      .eq("id", userId)
      .single();

    if (error || !data) {
      throw new ApiError(404, "PROFILE_NOT_FOUND", "Profile not found.");
    }

    const row = data as Record<string, unknown>;

    logApiRequest("GET", "/api/profile", 200, Date.now() - startTime);
    return NextResponse.json<ProfileResponse>({
      status: "success",
      profile: {
        id: row["id"] as string,
        email: (row["email"] as string | null) ?? null,
        displayName: (row["display_name"] as string | null) ?? null,
        firstName: (row["first_name"] as string | null) ?? null,
        lastName: (row["last_name"] as string | null) ?? null,
        avatarUrl: (row["avatar_url"] as string | null) ?? null,
        role: (row["role"] as string) ?? "user",
        plan: (row["plan"] as string) ?? "free",
        createdAt: row["created_at"] as string,
        updatedAt: row["updated_at"] as string,
      },
    });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    logApiRequest("GET", "/api/profile", statusCode, Date.now() - startTime);
    return NextResponse.json(createErrorResponse(error), { status: statusCode });
  }
}

export async function PATCH(request: NextRequest) {
  const startTime = Date.now();
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      logApiRequest("PATCH", "/api/profile", 401, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(new ApiError(401, "AUTH_REQUIRED", "Sign in to update your profile.")),
        { status: 401 }
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

    const updates: Record<string, string | null> = {};

    if ("displayName" in body) {
      const v = typeof body.displayName === "string" ? body.displayName.trim() : null;
      if (v !== null && v.length > 60) throw new ApiError(400, "VALIDATION_ERROR", "Display name max 60 characters.");
      updates["display_name"] = v || null;
    }
    if ("firstName" in body) {
      const v = typeof body.firstName === "string" ? body.firstName.trim() : null;
      if (v !== null && v.length > 60) throw new ApiError(400, "VALIDATION_ERROR", "First name max 60 characters.");
      updates["first_name"] = v || null;
    }
    if ("lastName" in body) {
      const v = typeof body.lastName === "string" ? body.lastName.trim() : null;
      if (v !== null && v.length > 60) throw new ApiError(400, "VALIDATION_ERROR", "Last name max 60 characters.");
      updates["last_name"] = v || null;
    }

    if (Object.keys(updates).length === 0) {
      throw new ApiError(400, "VALIDATION_ERROR", "No valid fields to update.");
    }

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId);

    if (error) {
      console.error("Profile update error:", error);
      throw new ApiError(500, "INTERNAL_ERROR", "Failed to update profile.");
    }

    logApiRequest("PATCH", "/api/profile", 200, Date.now() - startTime);
    return NextResponse.json({ status: "success" });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    logApiRequest("PATCH", "/api/profile", statusCode, Date.now() - startTime);
    return NextResponse.json(createErrorResponse(error), { status: statusCode });
  }
}
