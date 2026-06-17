/**
 * GET /auth/callback
 *
 * Supabase auth callback for:
 *   - Email confirmation links (signUp)
 *   - Magic link sign-in
 *   - OAuth provider redirects (Google, GitHub, etc.)
 *   - Password reset confirmation
 *
 * Supabase redirects here with a `code` (PKCE) or `token_hash` + `type`
 * query parameter. We exchange it for a session and redirect to the
 * `next` param (default: "/").
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function safeNextPath(value: string | null): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeNextPath(searchParams.get("next"));

  // Determine the base URL for redirect
  const redirectBase = process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.redirect(new URL("/login?error=auth_not_configured", redirectBase));
  }

  // We use a mutable response reference so the cookie proxy can set cookies.
  let response = NextResponse.redirect(new URL(next, redirectBase));

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.redirect(new URL(next, redirectBase));
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  if (code) {
    // PKCE code exchange (OAuth, magic link, email confirmation in some flows)
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("Auth callback code exchange error:", error.message);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, redirectBase)
      );
    }
    return response;
  }

  if (tokenHash && type) {
    // Token hash verification (email confirmation, password reset)
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as Parameters<typeof supabase.auth.verifyOtp>[0]["type"] });
    if (error) {
      console.error("Auth callback OTP verification error:", error.message);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, redirectBase)
      );
    }

    // For password-reset type, redirect to the update-password page
    if (type === "recovery") {
      return NextResponse.redirect(new URL("/auth/update-password", redirectBase));
    }

    return response;
  }

  // No code or token_hash — invalid callback
  return NextResponse.redirect(new URL("/login?error=invalid_callback", redirectBase));
}
