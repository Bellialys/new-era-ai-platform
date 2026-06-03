import Link from "next/link";
import { PromptArena } from "@/components/arena/prompt-arena";

export default function ArenaPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-8 sm:px-8 lg:px-10">
      <header className="mb-8 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-violet-200">Prompt Arena</p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Сравнение AI-моделей</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Введите задачу, выберите модели и получайте реальные ответы от AI через OpenRouter.
          </p>
        </div>
        <Link className="text-sm text-slate-300 transition hover:text-white" href="/">
          Вернуться на главную
        </Link>
      </header>

      <PromptArena />
    </main>
  );
}
