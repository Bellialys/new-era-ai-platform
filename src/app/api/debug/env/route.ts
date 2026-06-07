import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const openRouterKey = process.env.OPENROUTER_API_KEY ?? "";

  return NextResponse.json(
    {
      runtime: "node/server",
      appEnv: process.env.APP_ENV ?? process.env.NODE_ENV ?? "unknown",
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL ?? "unknown",
      hasOpenRouterKey: openRouterKey.length > 0,
      openRouterKeyLength: openRouterKey.length,
      startsWithSkOrV1: openRouterKey.startsWith("sk-or-v1"),
      hasLeadingOrTrailingWhitespace: openRouterKey !== openRouterKey.trim(),
      containsWhitespace: /\s/.test(openRouterKey),
      containsQuotes: openRouterKey.includes('"') || openRouterKey.includes("'"),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
