"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { getAuthErrorMessage } from "./auth-messages";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setErrorMessage("Authentication is not configured yet.");
      return;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage("Enter email and password.");
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      setErrorMessage(getAuthErrorMessage(error.message));
      setIsSubmitting(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <label className="grid gap-2 text-sm text-slate-300">
        Email
        <input
          autoComplete="email"
          className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/60"
          inputMode="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          type="email"
          value={email}
        />
      </label>

      <label className="grid gap-2 text-sm text-slate-300">
        Password
        <input
          autoComplete="current-password"
          className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/60"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Minimum 8 characters"
          type="password"
          value={password}
        />
      </label>

      {errorMessage ? (
        <p className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </p>
      ) : null}

      <button
        className="rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Signing in..." : "Login"}
      </button>
    </form>
  );
}
