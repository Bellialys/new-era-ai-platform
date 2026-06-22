import type { ArenaResponseView } from "@/types/arena";
import { ResponseCard } from "./response-card";

type ArenaResultsProps = {
  responses: ArenaResponseView[];
  isLoading: boolean;
  loadingModelNames: string[];
  winnerResponseId: string | null;
  canSaveWinner: boolean;
  voteStatus: "idle" | "saving" | "success" | "error";
  voteMessage: string | null;
  savingVoteResponseId: string | null;
  onSelectWinner: (responseId: string) => void | Promise<void>;
};

export function ArenaResults({
  responses,
  isLoading,
  loadingModelNames,
  winnerResponseId,
  canSaveWinner,
  voteStatus,
  voteMessage,
  savingVoteResponseId,
  onSelectWinner,
}: ArenaResultsProps) {
  if (isLoading && responses.length === 0) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
        <p className="mb-4 text-sm font-semibold text-slate-300">
          Запрашиваем ответы...
        </p>
        <div className="animate-pulse space-y-4">
          {loadingModelNames.length > 0 ? (
            loadingModelNames.map((name) => (
              <div key={name} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 animate-ping rounded-full bg-violet-400" />
                  <span className="text-sm text-slate-400">{name}</span>
                </div>
              </div>
            ))
          ) : (
            <>
              <div className="h-28 rounded-2xl bg-white/10" />
              <div className="h-28 rounded-2xl bg-white/10" />
            </>
          )}
        </div>
      </section>
    );
  }

  if (responses.length === 0) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-center backdrop-blur">
        <div className="mx-auto flex min-h-80 max-w-xl flex-col items-center justify-center">
          <h2 className="text-2xl font-black text-white">Ответов пока нет</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Введите задачу, выберите минимум две модели и нажмите кнопку запуска сравнения.
            После этого здесь появятся ответы моделей.
          </p>
        </div>
      </section>
    );
  }

  const streamingCount = responses.filter((r) => r.isStreaming).length;
  const successCount = responses.filter((r) => r.status === "success" && !r.isStreaming).length;
  const errorCount = responses.filter((r) => r.status === "error").length;

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white">
          Результаты
          <span className="ml-2 text-sm font-normal text-slate-400">
            {responses.length} {responses.length === 1 ? "модель" : "модели"}
          </span>
        </h2>
        <div className="flex gap-2">
          {streamingCount > 0 && (
            <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-semibold text-violet-100">
              {streamingCount} пишет
            </span>
          )}
          {successCount > 0 && (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100">
              {successCount} успешно
            </span>
          )}
          {errorCount > 0 && (
            <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-100">
              {errorCount} с ошибкой
            </span>
          )}
        </div>
      </div>
      {voteMessage ? (
        <div
          className={
            voteStatus === "error"
              ? "rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100"
              : voteStatus === "success"
                ? "rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-4 text-sm text-emerald-100"
                : "rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-sm text-slate-200"
          }
        >
          {voteMessage}
        </div>
      ) : null}
      {responses.map((response) => (
        <ResponseCard
          key={response.id}
          response={response}
          isWinner={winnerResponseId === response.id}
          canSaveWinner={canSaveWinner}
          isSavingWinner={savingVoteResponseId === response.id}
          isVoteLocked={voteStatus === "saving"}
          onSelectWinner={onSelectWinner}
        />
      ))}
    </section>
  );
}
