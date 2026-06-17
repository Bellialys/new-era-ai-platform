/**
 * POST /api/profile/avatar — upload user avatar to Supabase Storage
 *
 * Accepts multipart/form-data with a "file" field.
 * Constraints: JPEG/PNG/WEBP, max 2 MB.
 * Stores at avatars/{userId}/avatar.{ext}
 * Updates profiles.avatar_url with the signed URL.
 */
import { NextRequest, NextResponse } from "next/server";
import { createErrorResponse, logApiRequest, ApiError, getAuthenticatedUserId } from "@/lib/server";
import { getSupabaseServerClient } from "@/lib/server/supabase";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      logApiRequest("POST", "/api/profile/avatar", 401, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(new ApiError(401, "AUTH_REQUIRED", "Sign in to upload an avatar.")),
        { status: 401 }
      );
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) throw new ApiError(500, "INTERNAL_ERROR", "Storage not configured.");

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new ApiError(400, "INVALID_REQUEST", "Expected multipart/form-data.");
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(400, "VALIDATION_ERROR", "No file provided. Include a file field.");
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])) {
      throw new ApiError(400, "VALIDATION_ERROR", "Only JPEG, PNG, and WEBP images are allowed.");
    }

    if (file.size > MAX_SIZE_BYTES) {
      throw new ApiError(400, "VALIDATION_ERROR", "File size must be 2 MB or less.");
    }

    const ext = EXT_MAP[file.type] ?? "jpg";
    const storagePath = `${userId}/avatar.${ext}`;

    // Upsert (overwrite existing avatar)
    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Avatar upload error:", uploadError);
      throw new ApiError(500, "UPLOAD_FAILED", "Failed to upload avatar. Please try again.");
    }

    // Generate a signed URL valid for 1 year
    const { data: signedData, error: signError } = await supabase.storage
      .from("avatars")
      .createSignedUrl(storagePath, 365 * 24 * 60 * 60);

    if (signError || !signedData) {
      console.error("Signed URL error:", signError);
      throw new ApiError(500, "INTERNAL_ERROR", "Uploaded but could not generate URL.");
    }

    const avatarUrl = signedData.signedUrl;

    // Update profiles.avatar_url
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", userId);

    if (updateError) {
      console.error("Profile avatar_url update error:", updateError);
      // Non-fatal: the upload succeeded, just the DB update failed
    }

    logApiRequest("POST", "/api/profile/avatar", 200, Date.now() - startTime);
    return NextResponse.json({ status: "success", avatarUrl });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    logApiRequest("POST", "/api/profile/avatar", statusCode, Date.now() - startTime);
    return NextResponse.json(createErrorResponse(error), { status: statusCode });
  }
}

export async function DELETE(request: NextRequest) {
  const startTime = Date.now();
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      logApiRequest("DELETE", "/api/profile/avatar", 401, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(new ApiError(401, "AUTH_REQUIRED", "Sign in to delete your avatar.")),
        { status: 401 }
      );
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) throw new ApiError(500, "INTERNAL_ERROR", "Storage not configured.");

    // Try removing all common extensions
    const paths = ["jpg", "png", "webp"].map((ext) => `${userId}/avatar.${ext}`);
    await supabase.storage.from("avatars").remove(paths);

    // Clear avatar_url in profiles
    await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", userId);

    logApiRequest("DELETE", "/api/profile/avatar", 200, Date.now() - startTime);
    return NextResponse.json({ status: "success" });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    logApiRequest("DELETE", "/api/profile/avatar", statusCode, Date.now() - startTime);
    return NextResponse.json(createErrorResponse(error), { status: statusCode });
  }
}
