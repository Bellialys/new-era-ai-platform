/**
 * POST /api/guest — create or refresh an anonymous guest session.
 *
 * Flow:
 *  1. If the request already carries a valid `na_guest` cookie that matches a
 *     row in `anonymous_sessions`, touch `last_seen_at` and return existing info.
 *  2. Otherwise create a new row, set the `na_guest` httpOnly cookie, and
 *     return the generated display name + seeds.
 *
 * The cookie is what the backend uses for identity on subsequent requests.
 * The returned displayName/avatarSeed/colorSeed are stored in localStorage
 * by the client for display purposes only.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  readGuestSessionId,
  applyGuestCookie,
  ApiError,
  createErrorResponse,
  logApiRequest,
  getSupabaseServerClient,
} from "@/lib/server";

/** Generate a display name in the form "Анонимус #XXXX". */
function generateDisplayName(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `Анонимус #${num}`;
}

/** Generate a short random seed string for avatar / color derivation. */
function generateSeed(): string {
  return Math.random().toString(36).substring(2, 10);
}

interface GuestSessionResponse {
  status: "success";
  sessionId: string;
  displayName: string;
  avatarSeed: string;
  colorSeed: string;
  isNew: boolean;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<GuestSessionResponse | ReturnType<typeof createErrorResponse>>> {
  const startTime = Date.now();

  try {
    const supabase = getSupabaseServerClient();

    // --- Try to reuse existing session ---
    const existingId = readGuestSessionId(request);

    if (existingId && supabase) {
      const { data: existing } = await supabase
        .from("anonymous_sessions")
        .select("id, display_name, avatar_seed, color_seed")
        .eq("id", existingId)
        .single();

      if (existing) {
        // Touch last_seen_at (best-effort, don't fail the request on error)
        supabase
          .from("anonymous_sessions")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", existingId)
          .then(() => {/* fire and forget */});

        logApiRequest("POST", "/api/guest", 200, Date.now() - startTime);
        const response = NextResponse.json<GuestSessionResponse>({
          status: "success",
          sessionId: existing.id as string,
          displayName: existing.display_name as string,
          avatarSeed: existing.avatar_seed as string,
          colorSeed: existing.color_seed as string,
          isNew: false,
        });
        applyGuestCookie(response, existingId);
        return response;
      }
    }

    // --- Create a new session ---
    const displayName = generateDisplayName();
    const avatarSeed = generateSeed();
    const colorSeed = generateSeed();

    let newSessionId: string;

    if (supabase) {
      const { data: newRow, error } = await supabase
        .from("anonymous_sessions")
        .insert({ display_name: displayName, avatar_seed: avatarSeed, color_seed: colorSeed })
        .select("id")
        .single();

      if (error || !newRow) {
        console.error("Failed to insert anonymous_session:", error);
        throw new ApiError(500, "INTERNAL_ERROR", "Failed to create guest session.");
      }

      newSessionId = newRow.id as string;
    } else {
      // Supabase not configured — mint a local UUID so the app stays usable.
      newSessionId = crypto.randomUUID();
    }

    logApiRequest("POST", "/api/guest", 201, Date.now() - startTime);
    const response = NextResponse.json<GuestSessionResponse>(
      {
        status: "success",
        sessionId: newSessionId,
        displayName,
        avatarSeed,
        colorSeed,
        isNew: true,
      },
      { status: 201 }
    );
    applyGuestCookie(response, newSessionId);
    return response;
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    console.error("POST /api/guest error:", error);
    logApiRequest("POST", "/api/guest", statusCode, Date.now() - startTime);
    return NextResponse.json(createErrorResponse(error), { status: statusCode });
  }
}
