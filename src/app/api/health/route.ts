import { NextResponse } from "next/server";
import { getAvailableModels, getSupabaseServerClient, logApiRequest } from "@/lib/server";

type HealthStatus = "ok" | "degraded";

export async function GET() {
  const startTime = Date.now();
  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const openRouterConfigured = Boolean(process.env.OPENROUTER_API_KEY);

  let supabaseReachable: boolean | null = null;
  let supabaseModelsCount: number | null = null;
  let publicModelsCount: number | null = null;
  let catalogStatus: "ok" | "error" = "ok";
  let catalogError: string | null = null;

  const supabase = getSupabaseServerClient();

  if (supabase) {
    const { count, error } = await supabase
      .from("models")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("is_public", true);

    supabaseReachable = !error;
    supabaseModelsCount = error ? null : count ?? 0;
  }

  try {
    const models = await getAvailableModels();
    publicModelsCount = models.length;
  } catch (error) {
    catalogStatus = "error";
    catalogError = error instanceof Error ? error.message : "Unknown model catalog error";
  }

  const status: HealthStatus =
    supabaseConfigured &&
    openRouterConfigured &&
    supabaseReachable !== false &&
    catalogStatus === "ok" &&
    (publicModelsCount ?? 0) > 0
      ? "ok"
      : "degraded";

  logApiRequest("GET", "/api/health", 200, Date.now() - startTime);
  return NextResponse.json({
    status,
    version: process.env.npm_package_version ?? null,
    vercel: {
      environment: process.env.VERCEL_ENV ?? null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    },
    services: {
      supabase: {
        configured: supabaseConfigured,
        reachable: supabaseReachable,
        activePublicModels: supabaseModelsCount,
      },
      openRouter: {
        configured: openRouterConfigured,
      },
      modelCatalog: {
        status: catalogStatus,
        publicModels: publicModelsCount,
        error: catalogError,
      },
    },
  });
}
