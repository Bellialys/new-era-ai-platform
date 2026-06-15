import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresh the Supabase auth session on every request so server route handlers
 * always read a valid user. This is the standard @supabase/ssr proxy
 * (formerly "middleware") pattern: read cookies from the request, let the
 * client rewrite refreshed tokens, and copy them onto the outgoing response.
 *
 * When Supabase is not configured the request passes through untouched, so the
 * site keeps working without auth.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Touching getUser() triggers a token refresh into the response cookies when
  // the access token has expired. Do not add logic between client creation and
  // this call (per @supabase/ssr guidance).
  await supabase.auth.getUser();

  return response;
}
