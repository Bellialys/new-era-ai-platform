import type { HistoryResponseView, HistoryTaskView } from "@/types/history";
import type { JudgeVerdict } from "@/types/arena";
import { MODE_SLUG_AI_TEAM } from "@/lib/arena/team-mode";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { HistoryResponseCard } from "./history-response-card";
import { formatDateTime, modeLabel, statusLabel } from "./format";

function JudgeVerdictPanel({ verdict }: { verdict: JudgeVerdict }) {
  return (
    <section className="rounded-3xl border border-amber-400/20 bg-amber-500/5 p-6 backdrop-blur">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-amber-300">
        Вердикт судьи
      </h2>
      <p className="mb-4 text-sm font-semibold text-white">
        Победитель: <span className="text-amber-200">{verdict.winnerModelName}</span>
      </p>
      {Object.keys(verdict.scores).length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {Object.entries(verdict.scores).map(([modelId, score]) => (
            <span
              key={modelId}
              className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200"
            >
              {modelId}: {score}/10
            </span>
          ))}
        </div>
      )}
      <p className="text-sm leading-6 text-slate-300">{verdict.reasoning}</p>
    </section>
  );
}

export function HistoryDetail({
  task,
  responses,
}: {
  task: HistoryTaskView;
  responses: HistoryResponseView[];
}) {
  const isTeamTask = task.modeSlug === MODE_SLUG_AI_TEAM;
  const finalAnswer =
    isTeamTask && typeof task.settings.finalAnswer === "string"
      ? task.settings.finalAnswer
      : null;

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

      {finalAnswer ? (
        <section className="rounded-3xl border border-emerald-300/40 bg-emerald-500/10 p-6 shadow-2xl shadow-emerald-950/30 backdrop-blur">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
            Финальный ответ
          </h2>
          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm">
            <MarkdownRenderer content={finalAnswer} />
          </div>
        </section>
      ) : null}

      {responses.length > 0 ? (
        <section>
          {isTeamTask ? (
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Шаги команды
            </h2>
          ) : null}
          <div className={isTeamTask ? "grid gap-4" : "grid gap-4 lg:grid-cols-2"}>
            {responses.map((response) => (
              <HistoryResponseCard key={response.responseId} response={response} />
            ))}
          </div>
        </section>
      ) : null}

      {task.judgeVerdict ? <JudgeVerdictPanel verdict={task.judgeVerdict} /> : null}
    </div>
  );
}
