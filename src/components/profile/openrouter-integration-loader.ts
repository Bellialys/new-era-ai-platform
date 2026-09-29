export type OpenRouterIntegrationStatus = {
  connected: boolean;
  safeFingerprint: string | null;
  lastVerifiedAt: string | null;
  fundingSource: "platform" | "user_openrouter";
};

type StatusResponse = {
  status: "success";
  enabled: boolean;
  integration: OpenRouterIntegrationStatus;
};

export type OpenRouterIntegrationLoadResult =
  | {
      kind: "success";
      enabled: boolean;
      integration: OpenRouterIntegrationStatus;
    }
  | {
      kind: "error";
      message: string;
    };

const GENERIC_STATUS_ERROR =
  "Не удалось загрузить статус OpenRouter. Повторите попытку.";

function isIntegrationStatus(value: unknown): value is OpenRouterIntegrationStatus {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const status = value as Record<string, unknown>;
  return (
    typeof status.connected === "boolean" &&
    (status.safeFingerprint === null ||
      typeof status.safeFingerprint === "string") &&
    (status.lastVerifiedAt === null ||
      typeof status.lastVerifiedAt === "string") &&
    (status.fundingSource === "platform" ||
      status.fundingSource === "user_openrouter")
  );
}

export async function loadOpenRouterIntegrationStatus(
  fetchImpl: typeof fetch = fetch
): Promise<OpenRouterIntegrationLoadResult> {
  try {
    const response = await fetchImpl("/api/integrations/openrouter", {
      cache: "no-store",
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { message?: unknown }
        | null;
      return {
        kind: "error",
        message:
          typeof body?.message === "string" && body.message.trim()
            ? body.message
            : GENERIC_STATUS_ERROR,
      };
    }

    const body = (await response.json()) as Partial<StatusResponse>;
    if (
      body.status !== "success" ||
      typeof body.enabled !== "boolean" ||
      !isIntegrationStatus(body.integration)
    ) {
      return {
        kind: "error",
        message: GENERIC_STATUS_ERROR,
      };
    }

    return {
      kind: "success",
      enabled: body.enabled,
      integration: body.integration,
    };
  } catch {
    return {
      kind: "error",
      message: GENERIC_STATUS_ERROR,
    };
  }
}
