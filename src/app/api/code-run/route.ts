// Security notes:
// - Code runs in Piston's isolated Docker containers, NOT on our server
// - No access to our environment variables, filesystem, or network
// - 5-second execution timeout enforced by Piston
// - We never eval or exec user code server-side

import { NextRequest, NextResponse } from "next/server";
import {
  CODE_RUN_MAX_CHARS,
  CODE_RUN_RATE_LIMIT_MAX,
  CODE_RUN_RATE_LIMIT_WINDOW_MS,
  PISTON_API_URL,
} from "@/lib/arena/constants";
import {
  createErrorResponse,
  logApiRequest,
  ApiError,
  checkRateLimit,
  resolveRequestIdentity,
} from "@/lib/server";
import { LANGUAGE_CONFIG, type SupportedLanguage } from "@/lib/arena/code-languages";

const ALLOWED_LANGUAGES = Object.keys(LANGUAGE_CONFIG) as SupportedLanguage[];

interface PistonResponse {
  language: string;
  version: string;
  run: {
    stdout: string;
    stderr: string;
    code: number;
    cpu_time: number;
    output: string;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const identity = await resolveRequestIdentity(request);

    if (identity.kind !== "user") {
      logApiRequest("POST", "/api/code-run", 401, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(
          new ApiError(401, "AUTH_REQUIRED", "Войдите в аккаунт для запуска кода.")
        ),
        { status: 401 }
      );
    }

    const rateLimitKey = `code-run:user:${identity.userId}`;
    const rateLimit = await checkRateLimit(
      rateLimitKey,
      CODE_RUN_RATE_LIMIT_MAX,
      CODE_RUN_RATE_LIMIT_WINDOW_MS
    );

    if (rateLimit.limited) {
      logApiRequest("POST", "/api/code-run", 429, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(
          new ApiError(429, "RATE_LIMIT", "Превышен лимит запусков. Попробуйте позже.")
        ),
        {
          status: 429,
          headers: {
            "Retry-After": Math.max(Math.ceil((rateLimit.resetAt - Date.now()) / 1000), 1).toString(),
          },
        }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      logApiRequest("POST", "/api/code-run", 400, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.")),
        { status: 400 }
      );
    }

    const { code, language } = body as { code?: unknown; language?: unknown; responseId?: unknown };

    if (typeof language !== "string" || !ALLOWED_LANGUAGES.includes(language as SupportedLanguage)) {
      logApiRequest("POST", "/api/code-run", 400, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(
          new ApiError(400, "VALIDATION_ERROR", `Language must be one of: ${ALLOWED_LANGUAGES.join(", ")}.`)
        ),
        { status: 400 }
      );
    }

    if (typeof code !== "string" || code.length === 0) {
      logApiRequest("POST", "/api/code-run", 400, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(new ApiError(400, "VALIDATION_ERROR", "Code is required.")),
        { status: 400 }
      );
    }

    if (code.length > CODE_RUN_MAX_CHARS) {
      logApiRequest("POST", "/api/code-run", 400, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(
          new ApiError(400, "VALIDATION_ERROR", `Code must not exceed ${CODE_RUN_MAX_CHARS} characters.`)
        ),
        { status: 400 }
      );
    }

    const langConfig = LANGUAGE_CONFIG[language as SupportedLanguage];

    const pistonRes = await fetch(PISTON_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: langConfig.pistonId,
        version: langConfig.version,
        files: [{ content: code }],
        stdin: "",
        args: [],
        run_timeout: 5000,
        compile_timeout: 10000,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!pistonRes.ok) {
      throw new ApiError(502, "PISTON_ERROR", "Code execution service returned an error.");
    }

    const piston = (await pistonRes.json()) as PistonResponse;
    const run = piston.run;

    const stdout = (run.stdout ?? "").slice(0, 5000);
    const stderr = (run.stderr ?? "").slice(0, 5000);
    const exitCode = run.code ?? 0;
    const cpuTime = run.cpu_time ?? 0;

    logApiRequest("POST", "/api/code-run", 200, Date.now() - startTime);

    return NextResponse.json({ stdout, stderr, exitCode, cpuTime, language });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    console.error("POST /api/code-run error:", error);
    logApiRequest("POST", "/api/code-run", statusCode, Date.now() - startTime);
    return NextResponse.json(createErrorResponse(error), { status: statusCode });
  }
}
