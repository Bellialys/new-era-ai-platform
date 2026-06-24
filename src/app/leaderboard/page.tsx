import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { getLeaderboard } from "@/lib/server/leaderboard";
import { RefreshButton } from "./refresh-button";

export const dynamic = "force-dynamic";

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

export const metadata = {
  title: "Рейтинг моделей — Новая эпоха",
  description: "Рейтинг AI-моделей по результатам голосования пользователей.",
};

export default async function LeaderboardPage() {
  const entries = await getLeaderboard();

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-8 sm:px-8 lg:px-10">
      <SiteHeader>
        <span className="hidden text-sm text-slate-500 sm:inline">/ Рейтинг</span>
      </SiteHeader>

      <div className="mb-8 mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white sm:text-4xl">Рейтинг моделей</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Кто побеждает чаще всего — на основе голосов пользователей.
          </p>
          <div className="mt-3 flex gap-4 text-sm text-slate-400">
            <Link className="transition hover:text-white" href="/">
              На главную
            </Link>
            <Link className="transition hover:text-white" href="/arena">
              Arena
            </Link>
          </div>
        </div>
        <div className="shrink-0 pt-1">
          <RefreshButton />
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-8 py-16 text-center">
          <p className="text-3xl">📊</p>
          <p className="mt-3 text-lg font-semibold text-white">Нет данных</p>
          <p className="mt-2 text-sm text-slate-400">
            Рейтинг появится, когда пользователи начнут голосовать в Arena.
          </p>
          <Link
            href="/arena"
            className="mt-6 inline-flex items-center rounded-full border border-violet-300/30 bg-violet-500/15 px-5 py-2.5 text-sm font-semibold text-violet-200 transition hover:border-violet-300/60 hover:bg-violet-500/30"
          >
            Перейти в Arena →
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    #
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Модель
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Win rate
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Победы / Битвы
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {entries.map((entry) => (
                  <tr key={entry.modelId} className="transition hover:bg-white/[0.03]">
                    <td className="px-5 py-4 text-lg leading-none">
                      {entry.rank <= 3 ? (
                        RANK_MEDALS[entry.rank - 1]
                      ) : (
                        <span className="text-sm font-semibold text-slate-500">
                          #{entry.rank}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white">{entry.modelName}</span>
                        {entry.badge.map((b) => (
                          <span
                            key={b}
                            className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs text-violet-300"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-violet-500"
                            style={{ width: `${(entry.winRate * 100).toFixed(1)}%` }}
                          />
                        </div>
                        <span className="text-sm tabular-nums text-slate-300">
                          {(entry.winRate * 100).toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums">
                      <span className="text-sm text-white">{entry.wins}</span>
                      <span className="text-sm text-slate-500"> / {entry.totalBattles}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
