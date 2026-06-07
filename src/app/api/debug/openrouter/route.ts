import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENROUTER_KEY_URL = "https://openrouter.ai/api/v1/key";

type OpenRouterKeyErrorResponse = {
  error?: {
    code?: string | number;
    message?: string;
  };
};

function getSafeErrorMessage(status: number, fallback?: string): string {
  if (status === 401 || status === 403) {
    return "AI provider authentication failed.";
  }

  if (status === 402) {
    return "AI provider account has insufficient credits.";
  }

  if (status === 429) {
    return "AI provider rate limit exceeded.";
  }

  const message = fallback?.trim();
  if (!message) {
    return "AI provider key check failed.";
  }

  return message
    .replace(/sk-or-v1-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .slice(0, 160);
}

async function readSafeError(response: Response): Promise<{
  errorCode: string | null;
  errorMessage: string;
}> {
  try {
    const data = (await response.json()) as OpenRouterKeyErrorResponse;
    const rawCode = data.error?.code;

    return {
      errorCode: rawCode === undefined ? null : String(rawCode),
      errorMessage: getSafeErrorMessage(response.status, data.error?.message),
    };
  } catch {
    return {
      errorCode: "INVALID_RESPONSE",
      errorMessage: "AI provider returned a non-JSON error response.",
    };
  }
}

export async function GET() {
  const openRouterKey = process.env.OPENROUTER_API_KEY ?? "";

  if (!openRouterKey) {
    return NextResponse.json(
      {
        hasOpenRouterKey: false,
        openRouterKeyLength: 0,
        requestOk: false,
        status: 0,
        statusText: "Not requested",
        errorCode: "AI_SERVICE_NOT_CONFIGURED",
        errorMessage: "OPENROUTER_API_KEY is not configured.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  try {
    const response = await fetch(OPENROUTER_KEY_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
      },
      cache: "no-store",
    });

    if (response.ok) {
      return NextResponse.json(
        {
          hasOpenRouterKey: true,
          openRouterKeyLength: openRouterKey.length,
          requestOk: true,
          status: response.status,
          statusText: response.statusText,
          errorCode: null,
          errorMessage: null,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const safeError = await readSafeError(response);

    return NextResponse.json(
      {
        hasOpenRouterKey: true,
        openRouterKeyLength: openRouterKey.length,
        requestOk: false,
        status: response.status,
        statusText: response.statusText,
        errorCode: safeError.errorCode,
        errorMessage: safeError.errorMessage,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        hasOpenRouterKey: true,
        openRouterKeyLength: openRouterKey.length,
        requestOk: false,
        status: 0,
        statusText: "Network error",
        errorCode: "NETWORK_ERROR",
        errorMessage:
          error instanceof Error
            ? getSafeErrorMessage(0, error.message)
            : "Could not connect to AI provider.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
