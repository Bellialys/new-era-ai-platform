"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabase";

export function AuthStatus() {
  const [session, setSession] = useState<Session | null>(null);
  // Only start in the loading state when Supabase is actually configured.
  const [isLoading, setIsLoading] = useState(() => getSupabaseClient() !== null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      setSession(data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
      setIsSigningOut(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleLogout() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }

    setErrorMessage(null);
    setIsSigningOut(true);

    const { error } = await supabase.auth.signOut();

    if (error) {
      setErrorMessage("Could not sign out. Please try again.");
      setIsSigningOut(false);
      return;
    }

    setSession(null);
    setIsSigningOut(false);
  }

  // Hide all auth UI when Supabase is not configured (keeps the site usable).
  if (!getSupabaseClient()) {
    return null;
  }

  if (isLoading) {
    return <span className="text-xs text-slate-500">Checking session...</span>;
  }

  if (!session?.user) {
    return (
      <div className="flex items-center gap-2">
        <Link className="transition hover:text-white" href="/login">
          Login
        </Link>
        <Link
          className="rounded-full bg-white px-3 py-1.5 font-semibold text-slate-950 transition hover:bg-violet-100"
          href="/signup"
        >
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="max-w-48 truncate text-xs text-slate-400">
        {session.user.email}
      </span>
      <button
        className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSigningOut}
        onClick={handleLogout}
        type="button"
      >
        {isSigningOut ? "Logging out..." : "Logout"}
      </button>
      {errorMessage ? (
        <span className="basis-full text-right text-xs text-red-300">
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
}
