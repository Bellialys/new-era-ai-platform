import Link from "next/link";
import type { HistoryListItemView } from "@/types/history";
import { formatDateTime, modeLabel, pluralModels, statusLabel } from "./format";

export function HistoryList({ items }: { items: HistoryListItemView[] }) {
  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <li key={item.taskId}>
          <Link
            href={`/history/${item.taskId}`}
            className="block rounded-2xl border border-white/10 bg-white/[0.06] p-5 transition hover:border-violet-300/40 hover:bg-white/[0.09]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-semibold text-violet-200">
                    {modeLabel(item.modeSlug)}
                  </span>
                  {item.hasWinner ? (
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                      Победитель выбран
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-200">{item.taskText}</p>
              </div>
              <span className="shrink-0 text-slate-500" aria-hidden>
                →
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>{formatDateTime(item.createdAt)}</span>
              <span>
                {item.modelCount} {pluralModels(item.modelCount)}
              </span>
              <span>{statusLabel(item.status)}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
