import type { HistoryResponseView, HistoryTaskView } from "@/types/history";
import { HistoryResponseCard } from "./history-response-card";
import { formatDateTime, modeLabel, statusLabel } from "./format";

export function HistoryDetail({
  task,
  responses,
}: {
  task: HistoryTaskView;
  responses: HistoryResponseView[];
}) {
  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-semibold text-violet-200">
            {modeLabel(task.modeSlug)}
          </span>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-slate-300">
            {statusLabel(task.status)}
          </span>
          <span className="text-xs text-slate-500">{formatDateTime(task.createdAt)}</span>
        </div>
        <h2 className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          Задача
        </h2>
        <p className="mt-2 whitespace-pre-line text-base leading-7 text-slate-100">
          {task.taskText}
        </p>
        {task.errorMessage ? (
          <p className="mt-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
            {task.errorMessage}
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {responses.map((response) => (
          <HistoryResponseCard key={response.responseId} response={response} />
        ))}
      </section>
    </div>
  );
}
