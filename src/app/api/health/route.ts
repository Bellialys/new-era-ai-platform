import { NextResponse } from "next/server";
import {
  getAvailableModels,
  getSupabaseServerClient,
  logApiRequest,
  withTimeout,
} from "@/lib/server";

type HealthStatus = "ok" | "degraded";

const HEALTH_DEPENDENCY_TIMEOUT_MS = 3_500;

type SupabaseHealthProbe = {
  reachable: boolean | null;
  activePublicModels: number | null;
};

type ModelCatalogHealthProbe = {
  status: "ok" | "error";
  publicModels: number | null;
  error: string | null;
};

async function readSupabaseHealth(
  supabase: NonNullable<ReturnType<typeof getSupabaseServerClient>>
): Promise<SupabaseHealthProbe> {
  const { count, error } = await withTimeout(
    supabase
      .from("models")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("is_public", true),
    HEALTH_DEPENDENCY_TIMEOUT_MS,
    "Supabase health models count"
  );

  return {
    reachable: !error,
    activePublicModels: error ? null : count ?? 0,
  };
}

function toSafeHealthError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown model catalog error";
}

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

  const supabaseProbe = supabase
    ? readSupabaseHealth(supabase).catch((error) => {
        const message = toSafeHealthError(error);
        console.warn("Supabase health probe failed; reporting degraded.", { message });
        return { reachable: false, activePublicModels: null };
      })
    : Promise.resolve({ reachable: supabaseReachable, activePublicModels: supabaseModelsCount });

  const catalogProbe = getAvailableModels()
    .then(
      (models): ModelCatalogHealthProbe => ({
        status: "ok",
        publicModels: models.length,
        error: null,
      })
    )
    .catch((error): ModelCatalogHealthProbe => ({
      status: "error",
      publicModels: null,
      error: toSafeHealthError(error),
    }));

  const [supabaseHealth, catalogHealth] = await Promise.all([supabaseProbe, catalogProbe]);

  supabaseReachable = supabaseHealth.reachable;
  supabaseModelsCount = supabaseHealth.activePublicModels;
  publicModelsCount = catalogHealth.publicModels;
  catalogStatus = catalogHealth.status;
  catalogError = catalogHealth.error;

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
