"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { getAuthErrorMessage } from "./auth-messages";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errorCls = "rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200";
  const successCls = "rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const supabase = getSupabaseClient();
    if (!supabase) {
      setErrorMessage("Аутентификация не настроена.");
      return;
    }

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMessage("Введите email.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Пароль должен содержать минимум 8 символов.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Пароли не совпадают.");
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
    setSuccessMessage("Аккаунт создан. Проверьте email — мы отправили ссылку для подтверждения.");
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
        Пароль
        <input
          autoComplete="new-password"
          className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/60"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Минимум 8 символов"
          type="password"
          value={password}
        />
      </label>

      <label className="grid gap-2 text-sm text-slate-300">
        Повторите пароль
        <input
          autoComplete="new-password"
          className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/60"
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Повторите пароль"
          type="password"
          value={confirmPassword}
        />
      </label>

      {errorMessage ? <p className={errorCls}>{errorMessage}</p> : null}

      {successMessage ? (
        <p className={successCls}>
          {successMessage}{" "}
          <Link className="font-semibold text-white underline-offset-4 hover:underline" href="/login">
            Войти
          </Link>
        </p>
      ) : null}

      <button
        className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-violet-300/60 bg-violet-600 px-6 py-3 text-center text-sm font-extrabold leading-5 text-white shadow-lg shadow-violet-950/35 transition hover:border-violet-200 hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200 disabled:cursor-not-allowed disabled:border-slate-500/30 disabled:bg-slate-700 disabled:text-slate-200 disabled:shadow-none"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Создаём аккаунт..." : "Зарегистрироваться"}
      </button>
    </form>
  );
}
