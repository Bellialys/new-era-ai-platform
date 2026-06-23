import type { Metadata } from "next";
import Link from "next/link";
import { CodeArena } from "@/components/code-arena/code-arena";

export const metadata: Metadata = {
  title: "Code Arena — Новая эпоха",
  description: "Сравни кодовые решения нескольких AI-моделей для одной задачи",
};

export default function CodePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="mb-10">
        <nav className="mb-6 flex items-center justify-end gap-4 text-sm text-slate-300">
          <Link className="transition hover:text-white" href="/history">
            История
          </Link>
          <Link className="transition hover:text-white" href="/">
            На главную
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-bold text-violet-200">
            Code Arena
          </span>
          <span className="text-xs text-slate-500">Beta · v0.7</span>
        </div>
        <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">
          Сравни, кто пишет код лучше
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-400">
          Задай кодовую задачу, выбери язык и фреймворк — получи решения от нескольких
          AI-моделей одновременно и выбери лучшее.
        </p>
      </header>

      <CodeArena />
    </main>
  );
}
