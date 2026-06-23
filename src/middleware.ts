import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Middleware: request logging + Supabase auth session refresh
// ---------------------------------------------------------------------------
export function middleware(request: NextRequest): NextResponse {
  const start = Date.now();
  const { pathname } = request.nextUrl;

  const response = NextResponse.next();

  // Log API requests only
  if (pathname.startsWith("/api/")) {
    response.headers.set("x-request-start", String(start));
    // Attach timing header for downstream logging
    // Actual log happens post-response in a best-effort fashion via Vercel edge logs
    const logLine = `[${new Date(start).toISOString()}] ${request.method ?? "GET"} ${pathname}`;
    console.warn(logLine);
  }

  return response;
}

export const config = {
  matcher: [
    // Match all API routes and dynamic pages; exclude static assets
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
