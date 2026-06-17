/**
 * POST /api/profile/email — request an email address change
 *
 * Calls Supabase Auth updateUser({ email }) which sends a confirmation
 * email to BOTH the old and new address. The change only applies after
 * the user confirms via both links.
 *
 * We do not update profiles.email here — Supabase Auth fires a trigger
 * (handle_new_user_profile) on user update that syncs the email column.
 */
import { NextRequest, NextResponse } from "next/server";
import { createErrorResponse, logApiRequest, ApiError } from "@/lib/server";
import { createServerClient } from "@supabase/ssr";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) throw new ApiError(500, "INTERNAL_ERROR", "Auth not configured.");

    // Use the publishable client so the session cookie is read correctly
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // Route handlers do not set cookies; auth callback does.
        },
      },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      logApiRequest("POST", "/api/profile/email", 401, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(new ApiError(401, "AUTH_REQUIRED", "Sign in to change your email.")),
        { status: 401 }
      );
    }

    let body: { newEmail?: unknown };
    try {
      body = (await request.json()) as { newEmail?: unknown };
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    const newEmail = typeof body.newEmail === "string" ? body.newEmail.trim().toLowerCase() : null;
    if (!newEmail) throw new ApiError(400, "VALIDATION_ERROR", "Provide a newEmail field.");

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid email format.");
    }

    if (newEmail === userData.user.email?.toLowerCase()) {
      throw new ApiError(400, "VALIDATION_ERROR", "New email must differ from current email.");
    }

    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin}/auth/callback?next=/profile`;

    const { error: updateError } = await supabase.auth.updateUser(
      { email: newEmail },
      { emailRedirectTo: redirectTo }
    );

    if (updateError) {
      console.error("Email change error:", updateError.message);
      if (updateError.message.includes("already registered")) {
        throw new ApiError(409, "EMAIL_IN_USE", "This email is already associated with another account.");
      }
      throw new ApiError(500, "INTERNAL_ERROR", updateError.message);
    }

    logApiRequest("POST", "/api/profile/email", 200, Date.now() - startTime);
    return NextResponse.json({
      status: "success",
      message: "Confirmation emails sent to both addresses. Check your inbox.",
    });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    logApiRequest("POST", "/api/profile/email", statusCode, Date.now() - startTime);
    return NextResponse.json(createErrorResponse(error), { status: statusCode });
  }
}
