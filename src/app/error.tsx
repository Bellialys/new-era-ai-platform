"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error boundary:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <p className="inline-flex rounded-full border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
        Что-то пошло не так
      </p>
      <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
        Произошла непредвиденная ошибка
      </h1>
      <p className="max-w-lg text-sm leading-6 text-slate-400">
        Мы не смогли отобразить эту страницу. Попробуйте обновить — если ошибка повторяется,
        вернитесь на главную и зайдите снова.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-violet-300/60 bg-violet-600 px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-violet-950/35 transition hover:border-violet-200 hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
        >
          Попробовать снова
        </button>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10"
        >
          На главную
        </Link>
      </div>
    </main>
  );
}
