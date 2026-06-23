import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { PromptArena } from "@/components/arena/prompt-arena";

export default function ArenaPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-8 sm:px-8 lg:px-10">
      <SiteHeader>
        <span className="hidden text-sm text-slate-500 sm:inline">/ Prompt Arena</span>
      </SiteHeader>
      <div className="mb-8 mt-6">
        <h1 className="text-3xl font-black text-white sm:text-4xl">Сравнение AI-моделей</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
          Введите задачу, выберите модели и получайте реальные ответы от AI через OpenRouter.
        </p>
        <div className="mt-3 flex gap-4 text-sm text-slate-400">
          <Link className="transition hover:text-white" href="/">На главную</Link>
          <Link className="transition hover:text-white" href="/code">Code Arena</Link>
          <Link className="transition hover:text-white" href="/history">История</Link>
        </div>
      </div>

      <PromptArena />
    </main>
  );
}
