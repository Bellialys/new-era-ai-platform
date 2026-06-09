const baseUrl = (process.env.SMOKE_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const allowDegraded = process.env.ALLOW_DEGRADED === "1";

async function fetchJson(path) {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
    },
  });

  const text = await response.text();
  let body;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  return body;
}

const health = await fetchJson("/api/health");

if (!health || typeof health !== "object") {
  throw new Error("/api/health did not return a JSON object.");
}

if (health.status !== "ok" && !allowDegraded) {
  throw new Error(`/api/health returned status '${health.status}'. Set ALLOW_DEGRADED=1 to allow degraded smoke checks.`);
}

const modelsResponse = await fetchJson("/api/models");
const models = Array.isArray(modelsResponse?.models) ? modelsResponse.models : [];

if (models.length === 0) {
  throw new Error("/api/models returned no models.");
}

console.log("Smoke check passed", {
  baseUrl,
  healthStatus: health.status,
  models: models.length,
});
