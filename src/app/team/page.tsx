import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { TeamRunForm } from "./team-run-form";

function TeamModeDisabled() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-10 text-center backdrop-blur">
      <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-400">
        Скоро
      </span>
      <h2 className="mt-4 text-xl font-bold text-white">Team Mode — скоро</h2>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        Team Mode появится в v2.0. Следите за обновлениями.
      </p>
    </div>
  );
}

export const metadata: Metadata = {
  title: "Team Mode — Новая эпоха",
  description:
    "Запусти команду AI-агентов: Planner → Researcher → Critic → Finalizer работают последовательно над одной задачей.",
};

export default function TeamPage() {
  const isTeamModeEnabled = process.env.NEXT_PUBLIC_ENABLE_TEAM_MODE === "true";

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <SiteHeader>
        <span className="hidden text-sm text-slate-500 sm:inline">/ Team Mode</span>
      </SiteHeader>

      <div className="mb-10 mt-6">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-bold text-violet-200">
            AI Team Mode
          </span>
          <span className="text-xs text-slate-500">v2.0 · Alpha</span>
        </div>
        <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">
          Команда AI-агентов за одну задачу
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-400">
          Введи задачу — четыре роли поработают над ней последовательно: Planner разобьёт на
          шаги, Researcher наполнит знаниями, Critic найдёт слабые места, Finalizer соберёт
          финальный ответ.
        </p>
        <div className="mt-3 flex gap-4 text-sm text-slate-400">
          <Link className="transition hover:text-white" href="/">
            На главную
          </Link>
          <Link className="transition hover:text-white" href="/arena">
            Prompt Arena
          </Link>
          <Link className="transition hover:text-white" href="/history">
            История
          </Link>
        </div>
      </div>

      {isTeamModeEnabled ? <TeamRunForm /> : <TeamModeDisabled />}

      <footer className="mt-12 border-t border-white/5 pt-6 text-center text-xs text-slate-600">
        <p>
          Новая эпоха AI Platform &nbsp;·&nbsp;
          <a href="/privacy" className="transition hover:text-slate-400">
            Политика конфиденциальности
          </a>
          &nbsp;·&nbsp;
          <a href="/terms" className="transition hover:text-slate-400">
            Условия использования
          </a>
        </p>
      </footer>
    </main>
  );
}
