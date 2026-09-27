import { NextResponse } from "next/server";

const OPENROUTER_CURRENT_KEY_URL = "https://openrouter.ai/api/v1/key";
const TIMEOUT_MS = 15_000;

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json(
      { status: "not_found" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { status: "error", reason: "missing_openrouter_key" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_CURRENT_KEY_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return NextResponse.json(
        { status: "error", reason: "openrouter_http_error", providerStatus: response.status },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body: unknown = await response.json();
    const data =
      body && typeof body === "object" && !Array.isArray(body) && "data" in body
        ? (body as { data?: unknown }).data
        : null;

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return NextResponse.json(
        { status: "error", reason: "invalid_provider_response" },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    const meta = data as Record<string, unknown>;

    const probeStatus = async (url: string) => {
      try {
        const probeResponse = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });
        return probeResponse.status;
      } catch {
        return 0;
      }
    };

    const [managementKeysStatus, guardrailsStatus] = await Promise.all([
      probeStatus("https://openrouter.ai/api/v1/keys"),
      probeStatus("https://openrouter.ai/api/v1/guardrails"),
    ]);

    return NextResponse.json(
      {
        status: "pass",
        isFreeTier: meta.is_free_tier === true,
        isManagementKey: meta.is_management_key === true,
        isProvisioningKey: meta.is_provisioning_key === true,
        hasWorkspaceId:
          typeof meta.workspace_id === "string" && meta.workspace_id.trim().length > 0,
        hasLimit: typeof meta.limit === "number" && Number.isFinite(meta.limit),
        limitReset: typeof meta.limit_reset === "string" ? meta.limit_reset : null,
        hasExpiry:
          typeof meta.expires_at === "string" && meta.expires_at.trim().length > 0,
        managementKeysReadStatus: managementKeysStatus,
        guardrailsReadStatus: guardrailsStatus,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError"
      ? "provider_timeout"
      : "provider_request_failed";

    return NextResponse.json(
      { status: "error", reason },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  } finally {
    clearTimeout(timer);
  }
}
