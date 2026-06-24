import { NextRequest, NextResponse } from "next/server";
import {
  JUDGE_RATE_LIMIT_WINDOW_MS,
  JUDGE_RATE_LIMIT_MAX_REQUESTS,
  GUEST_JUDGE_RATE_LIMIT_WINDOW_MS,
  GUEST_JUDGE_RATE_LIMIT_MAX_REQUESTS,
  JUDGE_PRIMARY_MODEL_ID,
  JUDGE_FALLBACK_MODEL_ID,
  JUDGE_RESPONSE_TRUNCATE_CHARS,
} from "@/lib/arena/constants";
import {
  resolveRequestIdentity,
  checkRateLimit,
  fetchOpenRouterResponse,
  getSupabaseServerClient,
  logApiRequest,
  ApiError,
} from "@/lib/server";
import type { JudgeVerdict } from "@/types/arena";

export const maxDuration = 30;

const BLIND_LABELS = ["A", "B", "C", "D", "E"];

const JUDGE_SYSTEM_PROMPT = `You are an impartial AI judge evaluating multiple AI model responses to a user prompt.

Evaluation criteria (in priority order):
1. Accuracy and factual correctness
2. Completeness — does the response fully address the prompt?
3. Clarity and logical structure
4. Conciseness — shorter is better when quality is equal
5. Instruction following — did the model do what was asked?

You MUST respond with ONLY valid JSON, no text before or after. Use this exact format:
{
  "winner": "A",
  "reasoning": "2-3 sentences explaining why this response is best",
  "scores": {"A": 8, "B": 7}
}

The "winner" value must be one of the uppercase letter labels shown (A, B, C, D, or E).
Scores are integers 1-10. Do not include any text outside the JSON object.`;

function buildJudgeUserPrompt(
  prompt: string,
  responses: { modelName: string; answerText: string }[]
): string {
  const lines: string[] = [`USER PROMPT: ${prompt}`, ""];

  for (let i = 0; i < responses.length; i++) {
    const label = BLIND_LABELS[i] ?? String(i + 1);
    const text = responses[i]!.answerText.slice(0, JUDGE_RESPONSE_TRUNCATE_CHARS);
    const truncated = responses[i]!.answerText.length > JUDGE_RESPONSE_TRUNCATE_CHARS ? " [truncated]" : "";
    lines.push(`--- RESPONSE ${label} ---`);
    lines.push(text + truncated);
    lines.push("");
  }

  lines.push("Evaluate all responses above and return your verdict as JSON.");
  return lines.join("\n");
}

type JudgeRawOutput = {
  winner?: string;
  reasoning?: string;
  scores?: Record<string, unknown>;
};

function parseJudgeResponse(
  text: string,
  responses: { modelId: string; modelName: string }[]
): JudgeVerdict | null {
  let raw: JudgeRawOutput | null = null;
  try {
    raw = JSON.parse(text) as JudgeRawOutput;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        raw = JSON.parse(match[0]) as JudgeRawOutput;
      } catch {
        return null;
      }
    }
  }

  if (!raw || typeof raw.winner !== "string" || typeof raw.reasoning !== "string") {
    return null;
  }

  const winnerLabel = raw.winner.trim().toUpperCase();
  const winnerIndex = BLIND_LABELS.indexOf(winnerLabel);
  if (winnerIndex === -1 || winnerIndex >= responses.length) {
    return null;
  }

  const winner = responses[winnerIndex]!;

  const scores: Record<string, number> = {};
  if (raw.scores && typeof raw.scores === "object") {
    for (const [label, score] of Object.entries(raw.scores)) {
      const idx = BLIND_LABELS.indexOf(label.toUpperCase());
      if (idx !== -1 && idx < responses.length && typeof score === "number") {
        const model = responses[idx];
        if (model) scores[model.modelId] = Math.min(10, Math.max(1, Math.round(score)));
      }
    }
  }

  return {
    winnerModelId: winner.modelId,
    winnerModelName: winner.modelName,
    winnerLabel,
    reasoning: raw.reasoning.trim(),
    scores,
  };
}

function isValidResponseItem(item: unknown): item is { modelId: string; modelName: string; answerText: string } {
  return (
    typeof item === "object" &&
    item !== null &&
    typeof (item as Record<string, unknown>).modelId === "string" &&
    typeof (item as Record<string, unknown>).modelName === "string" &&
    typeof (item as Record<string, unknown>).answerText === "string"
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const identity = await resolveRequestIdentity(request);
    if (identity.kind === "none") {
      logApiRequest("POST", "/api/judge", 401, Date.now() - startTime, requestId);
      return NextResponse.json(
        { status: "error", errorCode: "AUTH_REQUIRED", message: "Sign in or continue as guest to use Judge Mode.", requestId },
        { status: 401 }
      );
    }

    const rateLimitKey =
      identity.kind === "user"
        ? `judge:user:${identity.userId}`
        : `judge:guest:${identity.guestId}`;
    const windowMs = identity.kind === "user" ? JUDGE_RATE_LIMIT_WINDOW_MS : GUEST_JUDGE_RATE_LIMIT_WINDOW_MS;
    const max = identity.kind === "user" ? JUDGE_RATE_LIMIT_MAX_REQUESTS : GUEST_JUDGE_RATE_LIMIT_MAX_REQUESTS;

    const { limited } = await checkRateLimit(rateLimitKey, max, windowMs);
    if (limited) {
      logApiRequest("POST", "/api/judge", 429, Date.now() - startTime, requestId);
      return NextResponse.json(
        { status: "error", errorCode: "RATE_LIMIT", message: "Слишком много запросов к судье. Подождите минуту.", requestId },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      logApiRequest("POST", "/api/judge", 400, Date.now() - startTime, requestId);
      return NextResponse.json(
        { status: "error", errorCode: "INVALID_BODY", message: "Invalid request body.", requestId },
        { status: 400 }
      );
    }

    if (typeof body !== "object" || body === null) {
      logApiRequest("POST", "/api/judge", 400, Date.now() - startTime, requestId);
      return NextResponse.json(
        { status: "error", errorCode: "INVALID_BODY", message: "Request body must be a JSON object.", requestId },
        { status: 400 }
      );
    }

    const b = body as Record<string, unknown>;
    const prompt = typeof b.prompt === "string" ? b.prompt.trim() : "";
    const taskId = typeof b.taskId === "string" ? b.taskId : null;
    const rawResponses = Array.isArray(b.responses) ? b.responses : [];

    if (prompt.length < 3) {
      logApiRequest("POST", "/api/judge", 400, Date.now() - startTime, requestId);
      return NextResponse.json(
        { status: "error", errorCode: "INVALID_PROMPT", message: "Prompt is too short.", requestId },
        { status: 400 }
      );
    }

    const validResponses = rawResponses.filter(isValidResponseItem);
    if (validResponses.length < 2) {
      logApiRequest("POST", "/api/judge", 400, Date.now() - startTime, requestId);
      return NextResponse.json(
        { status: "error", errorCode: "INVALID_RESPONSES", message: "At least 2 responses are required for judging.", requestId },
        { status: 400 }
      );
    }

    const judgeable = validResponses.filter((r) => r.answerText.trim().length > 0);
    if (judgeable.length < 2) {
      logApiRequest("POST", "/api/judge", 400, Date.now() - startTime, requestId);
      return NextResponse.json(
        { status: "error", errorCode: "INSUFFICIENT_RESPONSES", message: "At least 2 non-empty responses are required.", requestId },
        { status: 400 }
      );
    }

    const userPrompt = buildJudgeUserPrompt(prompt, judgeable);
    let judgeText: string;
    try {
      const result = await fetchOpenRouterResponse(userPrompt, JUDGE_PRIMARY_MODEL_ID, {
        systemPrompt: JUDGE_SYSTEM_PROMPT,
      });
      judgeText = result.text;
    } catch (primaryErr) {
      try {
        const result = await fetchOpenRouterResponse(userPrompt, JUDGE_FALLBACK_MODEL_ID, {
          systemPrompt: JUDGE_SYSTEM_PROMPT,
        });
        judgeText = result.text;
      } catch {
        throw primaryErr;
      }
    }

    const verdict = parseJudgeResponse(judgeText, judgeable);
    if (!verdict) {
      logApiRequest("POST", "/api/judge", 502, Date.now() - startTime, requestId);
      return NextResponse.json(
        { status: "error", errorCode: "JUDGE_PARSE_ERROR", message: "Судья вернул неожиданный формат ответа. Попробуйте ещё раз.", requestId },
        { status: 502 }
      );
    }

    if (taskId) {
      const supabase = getSupabaseServerClient();
      if (supabase) {
        await supabase
          .from("tasks")
          .update({ judge_verdict: verdict })
          .eq("id", taskId);
      }
    }

    logApiRequest("POST", "/api/judge", 200, Date.now() - startTime, requestId);
    return NextResponse.json({ status: "ok", verdict }, { status: 200 });
  } catch (error) {
    if (error instanceof ApiError) {
      logApiRequest("POST", "/api/judge", error.statusCode, Date.now() - startTime, requestId);
      return NextResponse.json(
        { status: "error", errorCode: error.errorCode, message: error.message, requestId },
        { status: error.statusCode }
      );
    }
    console.error("[/api/judge] Unexpected error:", error instanceof Error ? error.message : error);
    logApiRequest("POST", "/api/judge", 500, Date.now() - startTime, requestId);
    return NextResponse.json(
      { status: "error", errorCode: "INTERNAL_ERROR", message: "An unexpected error occurred.", requestId },
      { status: 500 }
    );
  }
}
