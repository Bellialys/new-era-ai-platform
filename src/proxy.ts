import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase-proxy";

/**
 * Auth proxy - runs on every request except static assets.
 *
 * Next.js 16 renamed middleware.ts to proxy.ts. updateSession() refreshes the
 * Supabase access token through the @supabase/ssr cookie proxy before route
 * handlers read the current user.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
