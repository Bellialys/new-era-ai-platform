/**
 * Vercel scheduled job: free OpenRouter model monitoring and discovery.
 * Authenticated exclusively with CRON_SECRET; no browser/session access.
 */
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/server/supabase";
import { createHealthSummary, runModelHealthSync } from "@/lib/server/model-health-sync";
import { logApiRequest } from "@/lib/server/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };
const PATH = "/api/cron/model-health";
const SYNC_TIMEOUT_MS = 46_000;
const JOURNAL_TIMEOUT_MS = 4_000;

type RunFailure =
  | "MODEL_HEALTH_CREDENTIALS_MISSING"
  | "MODEL_HEALTH_SYNC_FAILED"
  | "MODEL_HEALTH_DEADLINE_EXCEEDED";

function authorized(request: NextRequest, secret: string): boolean {
  if (secret.length < 32) return false;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = "Bearer " + secret;
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  const startedAt = new Date();
  const respond = (status: number, body: Record<string, unknown>) => {
    logApiRequest("GET", PATH, status, Date.now() - startedAt.getTime());
    return NextResponse.json(body, { status, headers: NO_STORE });
  };
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || secret.length < 32) {
    return respond(503, { status: "error", code: "CRON_NOT_CONFIGURED" });
  }
  if (!authorized(request, secret)) {
    return respond(401, { status: "error", code: "UNAUTHORIZED" });
  }
  if (process.env.ENABLE_MODEL_HEALTH_CRON !== "true") {
    return respond(503, { status: "disabled", code: "MODEL_HEALTH_DISABLED" });
  }

  const db = getSupabaseServerClient();
  if (!db) {
    return respond(503, { status: "error", code: "MODEL_HEALTH_CREDENTIALS_MISSING" });
  }
  const runDate = startedAt.toISOString().slice(0, 10);
  const source = request.headers.has("x-vercel-cron-schedule") ? "scheduled" : "manual";

  try {
    const { error: claimError } = await db.from("model_health_runs").insert({
      run_date: runDate,
      source,
      started_at: startedAt.toISOString(),
    }).abortSignal(AbortSignal.timeout(JOURNAL_TIMEOUT_MS));
    if (claimError?.code === "23505") {
      return respond(200, { status: "skipped", code: "MODEL_HEALTH_ALREADY_RUN", runDate });
    }
    if (claimError) throw new Error("Could not claim model health run.");

    const summary = createHealthSummary();
    const signal = AbortSignal.timeout(SYNC_TIMEOUT_MS);
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    let failure: RunFailure | null = null;
    if (!apiKey) {
      failure = "MODEL_HEALTH_CREDENTIALS_MISSING";
    } else {
      try {
        await runModelHealthSync(db, apiKey, { signal, summary });
      } catch {
        failure = signal.aborted ? "MODEL_HEALTH_DEADLINE_EXCEEDED" : "MODEL_HEALTH_SYNC_FAILED";
      }
    }

    const { data: finished, error: finishError } = await db.from("model_health_runs")
      .update({
        status: failure ? "failed" : "succeeded",
        finished_at: new Date().toISOString(),
        error_code: failure,
        inference_calls: summary.inferenceCalls,
        checked: summary.checked,
        healthy: summary.healthy,
        hidden: summary.hidden,
        restored: summary.restored,
        discovered: summary.discovered,
        published: summary.published,
        skipped: summary.skipped,
      })
      .eq("run_date", runDate)
      .eq("status", "running")
      .select("run_date")
      .abortSignal(AbortSignal.timeout(JOURNAL_TIMEOUT_MS))
      .maybeSingle();
    if (finishError || !finished) throw new Error("Could not finish model health run.");

    if (failure) {
      console.error("[model-health-cron] failed", { runDate, code: failure });
      return respond(503, { status: "error", code: failure, runDate });
    }
    return respond(200, { status: "success", runDate, summary });
  } catch (error) {
    console.error("[model-health-cron] journal unavailable", {
      runDate,
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return respond(503, { status: "error", code: "MODEL_HEALTH_JOURNAL_UNAVAILABLE", runDate });
  }
}
