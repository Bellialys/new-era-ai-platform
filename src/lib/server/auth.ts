/**
 * Server-side identity helpers.
 *
 * The backend must never trust a user id sent in a request body. Instead the
 * caller is identified two ways, in priority order:
 *   1. a verified Supabase user, read from the auth cookie (refreshed by the
 *      proxy) — RLS-scoped publishable client, so getUser() is trustworthy;
 *   2. an anonymous guest, identified by a server-set httpOnly cookie that the
 *      browser cannot forge per request.
 *
 * Both `/api/compare` and `/api/vote` derive identity through this module.
 */

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const GUEST_COOKIE_NAME = "na_guest";
const GUEST_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readPublicSupabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  return { url, key };
}

/**
 * Verified Supabase user id from the request's auth cookie, or null.
 * Read-only: token refresh is handled by the proxy, not here.
 */
export async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  const config = readPublicSupabaseConfig();
  if (!config) {
    return null;
  }

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // Route handlers do not refresh the session; the proxy does.
      },
    },
  });

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return null;
    }
    return data.user.id;
  } catch {
    return null;
  }
}

/** Existing, well-formed guest id from the httpOnly cookie, or null. */
export function readGuestSessionId(request: NextRequest): string | null {
  const value = request.cookies.get(GUEST_COOKIE_NAME)?.value;
  return value && UUID_PATTERN.test(value) ? value : null;
}

/** Reuse the guest cookie if present, otherwise mint a fresh guest id. */
export function ensureGuestSessionId(request: NextRequest): string {
  return readGuestSessionId(request) ?? crypto.randomUUID();
}

/** Persist the guest id as an httpOnly cookie on the outgoing response. */
export function applyGuestCookie(response: NextResponse, guestId: string): void {
  response.cookies.set(GUEST_COOKIE_NAME, guestId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GUEST_COOKIE_MAX_AGE_SECONDS,
  });
}

export type RequestIdentity =
  | { kind: "user"; userId: string; guestId: null }
  | { kind: "guest"; userId: null; guestId: string }
  | { kind: "none"; userId: null; guestId: null };

/**
 * Resolve the caller to a verified user, an existing anonymous guest, or
 * neither ("none"). Unlike the previous version this function no longer
 * auto-mints a fresh guest id: the caller must have explicitly created a
 * guest session via POST /api/guest before using protected endpoints.
 *
 * Routes that need an identity should return 401 AUTH_REQUIRED when they
 * receive { kind: "none" }.
 */
export async function resolveRequestIdentity(request: NextRequest): Promise<RequestIdentity> {
  const userId = await getAuthenticatedUserId(request);
  if (userId) {
    return { kind: "user", userId, guestId: null };
  }

  const guestId = readGuestSessionId(request);
  if (guestId) {
    return { kind: "guest", userId: null, guestId };
  }

  return { kind: "none", userId: null, guestId: null };
}
