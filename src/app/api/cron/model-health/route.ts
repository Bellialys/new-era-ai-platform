/**
 * Vercel scheduled job: free OpenRouter model monitoring and discovery.
 * Authenticated exclusively with CRON_SECRET; no browser/session access.
 */
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/server/supabase";
import { runModelHealthSync } from "@/lib/server/model-health-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

function authorized(request: NextRequest, secret: string): boolean {
  if (secret.length < 32) return false;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = "Bearer " + secret;
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 32) {
    return NextResponse.json(
      { status: "error", code: "CRON_NOT_CONFIGURED" },
      { status: 503, headers: NO_STORE },
    );
  }
  if (!authorized(request, secret)) {
    return NextResponse.json(
      { status: "error", code: "UNAUTHORIZED" },
      { status: 401, headers: NO_STORE },
    );
  }
  if (process.env.ENABLE_MODEL_HEALTH_CRON !== "true") {
    return NextResponse.json(
      { status: "disabled", code: "MODEL_HEALTH_DISABLED" },
      { status: 503, headers: NO_STORE },
    );
  }

  const db = getSupabaseServerClient();
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!db || !apiKey) {
    return NextResponse.json(
      { status: "error", code: "MODEL_HEALTH_CREDENTIALS_MISSING" },
      { status: 503, headers: NO_STORE },
    );
  }

  try {
    const summary = await runModelHealthSync(db, apiKey);
    return NextResponse.json(
      { status: "success", summary },
      { status: 200, headers: NO_STORE },
    );
  } catch (error) {
    console.error("[model-health-cron] failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      { status: "error", code: "MODEL_HEALTH_SYNC_FAILED" },
      { status: 503, headers: NO_STORE },
    );
  }
}
