"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { getAuthErrorMessage } from "./auth-messages";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Show message from password reset / error from auth callback
  const urlMessage = searchParams.get("message");
  const urlError = searchParams.get("error");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setErrorMessage("Аутентификация не настроена.");
      return;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage("Введите email и пароль.");
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

  const errorBorder = "rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200";
  const successBorder = "rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200";

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
        Пароль
        <input
          autoComplete="current-password"
          className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/60"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Минимум 8 символов"
          type="password"
          value={password}
        />
      </label>

      {urlMessage === "password_updated" && !errorMessage ? (
        <p className={successBorder}>Пароль обновлён. Войдите с новым паролем.</p>
      ) : null}

      {urlError && !errorMessage ? (
        <p className={errorBorder}>{decodeURIComponent(urlError)}</p>
      ) : null}

      {errorMessage ? (
        <p className={errorBorder}>{errorMessage}</p>
      ) : null}

      <div className="text-right">
        <Link
          href="/auth/reset-password"
          className="text-xs text-slate-400 transition hover:text-white"
        >
          Забыли пароль?
        </Link>
      </div>

      <button
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-violet-300/60 bg-violet-600 px-6 py-3 text-center text-sm font-extrabold leading-5 text-white shadow-lg shadow-violet-950/35 transition hover:border-violet-200 hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200 disabled:cursor-not-allowed disabled:border-slate-500/30 disabled:bg-slate-700 disabled:text-slate-200 disabled:shadow-none"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Вход..." : "Войти"}
      </button>
    </form>
  );
}
