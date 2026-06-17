"use client";

import Link from "next/link";

interface AccessGateProps {
  /** Called when the user clicks "Continue as guest". */
  onContinueAsGuest: () => void;
  /** True while the guest session is being created on the server. */
  isLoading: boolean;
  /** Error message to display if guest creation failed. */
  errorMessage: string | null;
}

/**
 * Full-width access gate shown before the user has chosen an identity mode.
 * The user must either sign in, create an account, or continue as a guest
 * before they can use Prompt Arena.
 */
export function AccessGate({ onContinueAsGuest, isLoading, errorMessage }: AccessGateProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-xl backdrop-blur-sm">
        {/* Icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-600/20 text-2xl">
          ⚡
        </div>

        {/* Heading */}
        <h2 className="mb-2 text-2xl font-black text-white">Добро пожаловать</h2>
        <p className="mb-8 text-sm leading-6 text-slate-400">
          Сравнивайте ответы разных AI-моделей в реальном времени.
          <br />
          Войдите или продолжите как гость.
        </p>

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-violet-600 px-6 text-sm font-bold text-white shadow-lg shadow-violet-950/40 transition hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
          >
            Войти
          </Link>

          <Link
            href="/signup"
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40"
          >
            Создать аккаунт
          </Link>

          <div className="relative my-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-transparent px-3 text-xs text-slate-500">или</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onContinueAsGuest}
            disabled={isLoading}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/10 bg-transparent px-6 text-sm font-medium text-slate-300 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Создаём профиль…
              </span>
            ) : (
              "Продолжить как гость"
            )}
          </button>
        </div>

        {/* Guest disclaimer */}
        {!errorMessage && (
          <p className="mt-4 text-xs text-slate-500">
            Гостевой режим: только бесплатные модели. История не сохраняется.
          </p>
        )}

        {/* Error */}
        {errorMessage && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {errorMessage}
          </p>
        )}
      </div>
    </div>
  );
}
