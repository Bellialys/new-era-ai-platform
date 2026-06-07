"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { getAuthErrorMessage } from "./auth-messages";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Enter your email.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      setErrorMessage(getAuthErrorMessage(error.message));
      setIsSubmitting(false);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setSuccessMessage("Account created. Check your email if confirmation is enabled.");
    setIsSubmitting(false);
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
          autoComplete="new-password"
          className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/60"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Minimum 8 characters"
          type="password"
          value={password}
        />
      </label>

      <label className="grid gap-2 text-sm text-slate-300">
        Confirm password
        <input
          autoComplete="new-password"
          className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/60"
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Repeat password"
          type="password"
          value={confirmPassword}
        />
      </label>

      {errorMessage ? (
        <p className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {successMessage}{" "}
          <Link className="font-semibold text-white underline-offset-4 hover:underline" href="/login">
            Login
          </Link>
        </p>
      ) : null}

      <button
        className="rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Creating account..." : "Sign up"}
      </button>
    </form>
  );
}
