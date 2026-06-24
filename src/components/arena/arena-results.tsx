import Link from "next/link";
import type { ArenaModel, ArenaResponseView } from "@/types/arena";
import { ResponseCard } from "./response-card";

const BLIND_LABELS = ["Модель A", "Модель B", "Модель C", "Модель D", "Модель E"];

type ArenaResultsProps = {
  responses: ArenaResponseView[];
  isLoading: boolean;
  loadingModelNames: string[];
  winnerResponseId: string | null;
  canSaveWinner: boolean;
  voteStatus: "idle" | "saving" | "success" | "error";
  voteMessage: string | null;
  savingVoteResponseId: string | null;
  prompt: string;
  taskId: string | null;
  blindMode: boolean;
  sessionWins: Record<string, number>;
  allModels: ArenaModel[];
  onToggleBlindMode: () => void;
  onSelectWinner: (responseId: string) => void | Promise<void>;
};

function getResponseGridClass(count: number): string {
  if (count <= 2) return "grid-cols-1 md:grid-cols-2";
  if (count <= 3) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
  if (count <= 4) return "grid-cols-1 sm:grid-cols-2";
  return "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3";
}

export function ArenaResults({
  responses,
  isLoading,
  loadingModelNames,
  winnerResponseId,
  canSaveWinner,
  voteStatus,
  voteMessage,
  savingVoteResponseId,
  prompt,
  taskId,
  blindMode,
  sessionWins,
  allModels,
  onToggleBlindMode,
  onSelectWinner,
}: ArenaResultsProps) {
  // After voting, always reveal real names
  const showBlind = blindMode && !winnerResponseId;

  async function handleCopyAll() {
    if (!responses.length) return;
    const lines: string[] = [`Задача: ${prompt}`, ""];
    for (let i = 0; i < responses.length; i++) {
      const r = responses[i];
      const label = showBlind ? BLIND_LABELS[i] ?? `Модель ${i + 1}` : r.modelName;
      lines.push(`--- ${label} ---`);
      lines.push(r.answerText ?? r.errorMessage ?? "Нет ответа");
      lines.push("");
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
    } catch {
      // ignore
    }
  }

  if (isLoading) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
        <p className="mb-4 text-sm font-semibold text-slate-300">Запрашиваем ответы...</p>
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
          </p>
        </div>
      </section>
    );
  }

  const successCount = responses.filter((r) => r.status === "success").length;
  const errorCount = responses.length - successCount;

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-white">
          Результаты
          <span className="ml-2 text-sm font-normal text-slate-400">
            {responses.length} {responses.length === 1 ? "модель" : "модели"}
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
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
          {/* Blind mode toggle */}
          <button
            onClick={onToggleBlindMode}
            title={blindMode ? "Показать модели" : "Скрыть модели (blind mode)"}
            className={`inline-flex min-h-[44px] items-center justify-center rounded-full border px-3 text-xs font-semibold transition ${
              blindMode && !winnerResponseId
                ? "border-violet-400/50 bg-violet-500/20 text-violet-200"
                : "border-white/15 text-slate-400 hover:border-white/30 hover:text-white"
            }`}
            type="button"
          >
            {blindMode && !winnerResponseId ? "🙈 Скрыто" : "👁 Открыто"}
          </button>
          {/* Copy all */}
          {successCount > 0 && (
            <button
              onClick={handleCopyAll}
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/15 px-3 text-xs font-semibold text-slate-400 transition hover:border-white/30 hover:text-white"
              type="button"
            >
              Копировать всё
            </button>
          )}
          {/* Share */}
          {taskId && (
            <Link
              href={`/share/${taskId}`}
              target="_blank"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/15 px-3 text-xs font-semibold text-slate-400 transition hover:border-white/30 hover:text-white"
            >
              Поделиться
            </Link>
          )}
        </div>
      </div>

      {/* Reveal hint */}
      {showBlind && (
        <p className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-2.5 text-xs text-violet-200">
          Режим слепого тестирования активен — имена моделей скрыты до голосования.
        </p>
      )}
      {winnerResponseId && blindMode && (
        <p className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-200">
          Голос отдан — имена моделей раскрыты.
        </p>
      )}

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

      {/* Session win stats */}
      {Object.keys(sessionWins).length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-2.5 text-xs">
          <span className="font-semibold text-amber-200">Счёт сессии:</span>
          {Object.entries(sessionWins)
            .sort(([, a], [, b]) => b - a)
            .map(([modelId, wins]) => {
              const model = allModels.find((m) => m.id === modelId);
              const name = model?.name ?? modelId;
              return (
                <span key={modelId} className="rounded-full bg-amber-500/20 px-2 py-0.5 text-amber-100">
                  {name}: {wins} {wins === 1 ? "победа" : wins < 5 ? "победы" : "побед"}
                </span>
              );
            })}
        </div>
      )}

      <div className={`grid gap-4 ${getResponseGridClass(responses.length)}`}>
        {responses.map((response, index) => (
          <ResponseCard
            key={response.id}
            response={response}
            isWinner={winnerResponseId === response.id}
            canSaveWinner={canSaveWinner}
            isSavingWinner={savingVoteResponseId === response.id}
            isVoteLocked={voteStatus === "saving"}
            blindLabel={showBlind ? (BLIND_LABELS[index] ?? `Модель ${index + 1}`) : undefined}
            onSelectWinner={onSelectWinner}
          />
        ))}
      </div>
    </section>
  );
}
