#!/usr/bin/env node
/**
 * Read-only OpenRouter account/key capability probe.
 *
 * Security:
 * - never prints the API key;
 * - never prints usage/cost/balance;
 * - never prints workspace identifiers or labels;
 * - performs GET /api/v1/key only;
 * - emits a small boolean/status document suitable for CI logs.
 */

const API_URL = "https://openrouter.ai/api/v1/key";
const TIMEOUT_MS = 15_000;

function fail(message) {
  console.error(JSON.stringify({ status: "error", message }));
  process.exitCode = 1;
}

const apiKey = process.env.OPENROUTER_API_KEY?.trim();
if (!apiKey) {
  fail("OPENROUTER_API_KEY is not available to the probe.");
} else {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: "GET",
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      fail(`OpenRouter current-key probe returned HTTP ${response.status}.`);
    } else {
      const body = await response.json();
      const data = body?.data;

      if (!data || typeof data !== "object" || Array.isArray(data)) {
        fail("OpenRouter current-key response did not contain an object data field.");
      } else {
        const result = {
          status: "pass",
          isFreeTier: data.is_free_tier === true,
          isManagementKey: data.is_management_key === true,
          isProvisioningKey: data.is_provisioning_key === true,
          hasWorkspaceId:
            typeof data.workspace_id === "string" && data.workspace_id.trim().length > 0,
          hasLimit: typeof data.limit === "number" && Number.isFinite(data.limit),
          limitReset:
            typeof data.limit_reset === "string" ? data.limit_reset : null,
          hasExpiry:
            typeof data.expires_at === "string" && data.expires_at.trim().length > 0,
        };

        console.log(JSON.stringify(result));
      }
    }
  } catch (error) {
    fail(
      error?.name === "AbortError"
        ? `OpenRouter current-key probe timed out after ${TIMEOUT_MS}ms.`
        : "OpenRouter current-key probe failed.",
    );
  } finally {
    clearTimeout(timer);
  }
}
