import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  ApiError, checkRateLimit, createErrorResponse, getAuthenticatedUserId,
  getSupabaseServerClient, isUuid, logApiRequest,
} from "@/lib/server";
import { requireSameOriginMutation } from "@/lib/server/openrouter-integration-security";
import {
  parseSavedPromptInput, toSavedPromptDto, type SavedPromptRow,
} from "@/lib/server/saved-prompts";

export const dynamic = "force-dynamic";
const ROUTE = "/api/saved-prompts/[id]";
const SELECT = "id, title, prompt_text, created_at, updated_at";
const NO_STORE = { "Cache-Control": "private, no-store" };
type Context = { params: Promise<{ id: string }> };

async function authorize(request: NextRequest, action: "read" | "write"): Promise<string> {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) throw new ApiError(401, "AUTH_REQUIRED", "Sign in to manage saved prompts.");
  const limit = await checkRateLimit(
    "saved-prompts:" + action + ":" + userId,
    action === "read" ? 60 : 20, 60_000
  );
  if (limit.limited) throw new ApiError(429, "RATE_LIMIT", "Too many requests.");
  return userId;
}

function failure(error: unknown, method: string, start: number): NextResponse {
  const status = error instanceof ApiError ? error.statusCode : 500;
  if (status === 500) console.error("Saved prompt request failed:", error);
  logApiRequest(method, ROUTE, status, Date.now() - start);
  return NextResponse.json(createErrorResponse(error), { status, headers: NO_STORE });
}

/** Read a single draft; unowned and absent ids are indistinguishable (404). */
export async function GET(request: NextRequest, context: Context): Promise<NextResponse> {
  const start = Date.now();
  try {
    const userId = await authorize(request, "read");
    const { id } = await context.params;
    if (!isUuid(id)) throw new ApiError(400, "VALIDATION_ERROR", "Invalid prompt ID.");
    const db = getSupabaseServerClient();
    if (!db) throw new ApiError(503, "PERSISTENCE_UNAVAILABLE", "Database unavailable.");
    const { data, error } = await db.from("saved_prompts")
      .select(SELECT).eq("id", id).eq("user_id", userId).maybeSingle();
    if (error) throw new ApiError(503, "PERSISTENCE_UNAVAILABLE", "Cannot load prompt.");
    if (!data) throw new ApiError(404, "NOT_FOUND", "Saved prompt not found.");
    logApiRequest("GET", ROUTE, 200, Date.now() - start);
    return NextResponse.json({
      status: "success",
      item: toSavedPromptDto(data as SavedPromptRow),
    }, { headers: NO_STORE });
  } catch (error) {
    return failure(error, "GET", start);
  }
}

/** Partial update, always scoped to the caller even with the service-role client. */
export async function PATCH(request: NextRequest, context: Context): Promise<NextResponse> {
  const start = Date.now();
  try {
    requireSameOriginMutation(request);
    const userId = await authorize(request, "write");
    const { id } = await context.params;
    if (!isUuid(id)) throw new ApiError(400, "VALIDATION_ERROR", "Invalid prompt ID.");
    let body: unknown;
    try { body = await request.json(); }
    catch { throw new ApiError(400, "INVALID_JSON", "Body must be valid JSON."); }
    const changes = parseSavedPromptInput(body, "update");
    const db = getSupabaseServerClient();
    if (!db) throw new ApiError(503, "PERSISTENCE_UNAVAILABLE", "Database unavailable.");

    const { data, error } = await db.from("saved_prompts")
      .update({ ...changes, updated_at: new Date().toISOString() })
      .eq("id", id).eq("user_id", userId).select(SELECT).maybeSingle();
    if (error) throw new ApiError(503, "PERSISTENCE_UNAVAILABLE", "Cannot update prompt.");
    if (!data) throw new ApiError(404, "NOT_FOUND", "Saved prompt not found.");

    revalidatePath("/saved-prompts");
    logApiRequest("PATCH", ROUTE, 200, Date.now() - start);
    return NextResponse.json({
      status: "success", item: toSavedPromptDto(data as SavedPromptRow),
    }, { headers: NO_STORE });
  } catch (error) {
    return failure(error, "PATCH", start);
  }
}

/** Delete only the authenticated user's draft, never another user's record. */
export async function DELETE(request: NextRequest, context: Context): Promise<NextResponse> {
  const start = Date.now();
  try {
    requireSameOriginMutation(request);
    const userId = await authorize(request, "write");
    const { id } = await context.params;
    if (!isUuid(id)) throw new ApiError(400, "VALIDATION_ERROR", "Invalid prompt ID.");
    const db = getSupabaseServerClient();
    if (!db) throw new ApiError(503, "PERSISTENCE_UNAVAILABLE", "Database unavailable.");

    const { data, error } = await db.from("saved_prompts")
      .delete().eq("id", id).eq("user_id", userId).select("id").maybeSingle();
    if (error) throw new ApiError(503, "PERSISTENCE_UNAVAILABLE", "Cannot delete prompt.");
    if (!data) throw new ApiError(404, "NOT_FOUND", "Saved prompt not found.");

    revalidatePath("/saved-prompts");
    logApiRequest("DELETE", ROUTE, 200, Date.now() - start);
    return NextResponse.json({ status: "success", deleted: true }, { headers: NO_STORE });
  } catch (error) {
    return failure(error, "DELETE", start);
  }
}
