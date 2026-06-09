import Link from "next/link";
import { AuthStatus } from "@/components/auth/auth-status";
import { PromptArenaVoting } from "@/components/arena/prompt-arena-voting";

export default function ArenaVotingPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-8 sm:px-8 lg:px-10">
      <header className="mb-8 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-violet-200">Prompt Arena Voting</p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Сравнение AI-моделей с сохранением победителя</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Введите задачу, выберите модели, получите реальные ответы через OpenRouter и сохраните лучший ответ.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link className="text-sm text-slate-300 transition hover:text-white" href="/arena">
            Обычная Arena
          </Link>
          <Link className="text-sm text-slate-300 transition hover:text-white" href="/">
            На главную
          </Link>
          <AuthStatus />
        </div>
      </header>

      <PromptArenaVoting />
    </main>
  );
}
