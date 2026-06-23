"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { createOrRefreshGuestSession, type GuestInfo } from "@/lib/guest";
import type { ArenaModel, ArenaApiResponse, ArenaResponseView } from "@/types/arena";
import {
  type CodeArenaLanguage,
  CODE_PROMPT_MAX_LENGTH,
  CODE_MODEL_MIN_SELECT,
  CODE_MODEL_MAX_SELECT,
} from "@/lib/arena/constants";
import { AccessGate } from "@/components/arena/access-gate";
import { ProgrammingContextForm } from "./programming-context-form";
import { CodeResponseCard } from "./code-response-card";
import { CodeDiffView } from "./code-diff-view";
import { CodeTemplates } from "./code-templates";

// ---------------------------------------------------------------------------
// Identity state
// ---------------------------------------------------------------------------
type IdentityMode = "loading" | "gate" | "guest" | "user";

const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-indigo-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-fuchsia-500",
  "bg-cyan-500",
];

function getAvatarColorClass(seed: string): string {
  const n = parseInt(seed, 16) || seed.charCodeAt(0) || 0;
  return AVATAR_COLORS[Math.abs(n) % AVATAR_COLORS.length];
}

function GuestCard({ info, onSignIn }: { info: GuestInfo; onSignIn: () => void }) {
  const colorClass = getAvatarColorClass(info.colorSeed);
  const initials = info.displayName.slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colorClass} text-xs font-bold text-white`}>
        {initials}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{info.displayName}</p>
        <p className="text-xs text-slate-400">Гость · Только бесплатные модели</p>
      </div>
      <button
        onClick={onSignIn}
        className="ml-auto inline-flex min-h-[44px] shrink-0 items-center rounded-full border border-violet-300/40 bg-violet-600/20 px-3 text-xs font-semibold text-violet-100 transition hover:border-violet-300/70 hover:bg-violet-600/40"
      >
        Войти
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Code Arena component
// ---------------------------------------------------------------------------
export function CodeArena() {
  // Identity
  const [identityMode, setIdentityMode] = useState<IdentityMode>("loading");
  const [guestInfo, setGuestInfo] = useState<GuestInfo | null>(null);
  const [isCreatingGuest, setIsCreatingGuest] = useState(false);
  const [guestCreateError, setGuestCreateError] = useState<string | null>(null);

  // Form state
  const [prompt, setPrompt] = useState("");
  const [language, setLanguage] = useState<CodeArenaLanguage>("TypeScript");
  const [framework, setFramework] = useState<string | null>("Next.js");
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);

  // Models
  const [models, setModels] = useState<ArenaModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  // Results
  const [isLoading, setIsLoading] = useState(false);
  const [responses, setResponses] = useState<ArenaResponseView[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [currentLanguage, setCurrentLanguage] = useState<string>("TypeScript");
  const [currentFramework, setCurrentFramework] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Voting
  const [winnerResponseId, setWinnerResponseId] = useState<string | null>(null);
  const [voteStatus, setVoteStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [voteMessage, setVoteMessage] = useState<string | null>(null);
  const [savingVoteResponseId, setSavingVoteResponseId] = useState<string | null>(null);
  const [blindMode, setBlindMode] = useState(true);

  // ---------------------------------------------------------------------------
  // Identity resolution
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      queueMicrotask(() => setIdentityMode("gate"));
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session?.user) {
        setIdentityMode("user");
        return;
      }
      const stored = localStorage.getItem("na_guest_info");
      if (stored) {
        try {
          const info = JSON.parse(stored) as GuestInfo;
          setGuestInfo(info);
          setIdentityMode("guest");
        } catch {
          setIdentityMode("gate");
        }
      } else {
        setIdentityMode("gate");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setIdentityMode("user");
        setGuestInfo(null);
      } else {
        const stored = localStorage.getItem("na_guest_info");
        if (stored) {
          try {
            const info = JSON.parse(stored) as GuestInfo;
            setGuestInfo(info);
            setIdentityMode("guest");
          } catch {
            setIdentityMode("gate");
          }
        } else {
          setIdentityMode("gate");
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleContinueAsGuest() {
    setIsCreatingGuest(true);
    setGuestCreateError(null);
    try {
      const info = await createOrRefreshGuestSession();
      setGuestInfo(info);
      setIdentityMode("guest");
    } catch (error) {
      setGuestCreateError(
        error instanceof Error ? error.message : "Не удалось создать гостевой профиль. Попробуйте ещё раз."
      );
    } finally {
      setIsCreatingGuest(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Load code models when identity is resolved
  // ---------------------------------------------------------------------------
  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const response = await fetch("/api/code-models");
      if (!response.ok) {
        console.error("Failed to load code models");
        return;
      }
      const data = (await response.json()) as { status: string; models: ArenaModel[] };
      if (data.status === "success") {
        setModels(data.models);
        if (data.models.length >= 2) {
          setSelectedModelIds([data.models[0].id, data.models[1].id]);
        }
      }
    } catch (err) {
      console.error("Code models load error:", err);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (identityMode === "guest" || identityMode === "user") {
      // async dispatch to avoid synchronous setState within effect
      void Promise.resolve().then(() => loadModels());
    }
  }, [identityMode, loadModels]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  function handleToggleModel(modelId: string) {
    setSelectedModelIds((prev) => {
      if (prev.includes(modelId)) {
        return prev.filter((id) => id !== modelId);
      }
      if (prev.length >= CODE_MODEL_MAX_SELECT) return prev;
      return [...prev, modelId];
    });
  }

  async function handleSubmit() {
    setErrorMessage(null);

    if (!prompt.trim()) {
      setErrorMessage("Введите задачу.");
      return;
    }
    if (selectedModelIds.length < CODE_MODEL_MIN_SELECT) {
      setErrorMessage(`Выберите минимум ${CODE_MODEL_MIN_SELECT} модели.`);
      return;
    }

    setIsLoading(true);
    setResponses([]);
    setTaskId(null);
    setWinnerResponseId(null);
    setVoteStatus("idle");
    setVoteMessage(null);
    setBlindMode(true);
    setCurrentLanguage(language);
    setCurrentFramework(framework);

    try {
      const res = await fetch("/api/code-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          modelIds: selectedModelIds,
          language,
          framework,
          runTests: false,
        }),
      });

      const data = (await res.json()) as {
        status: string;
        taskId?: string | null;
        responses?: ArenaApiResponse[];
        error?: { message?: string };
      };

      if (!res.ok || data.status === "error") {
        setErrorMessage(data.error?.message ?? "Не удалось получить ответы. Попробуйте снова.");
        return;
      }

      if (data.taskId) setTaskId(data.taskId);

      const modelRoleMap = Object.fromEntries(models.map((m) => [m.id, m.role]));
      const views: ArenaResponseView[] = (data.responses ?? []).map((r) => ({
        ...r,
        modelRole: modelRoleMap[r.modelId] ?? "AI-модель",
      }));
      setResponses(views);
    } catch {
      setErrorMessage("Ошибка сети. Проверьте соединение и попробуйте снова.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleReset() {
    setPrompt("");
    setSelectedModelIds(models.length >= 2 ? [models[0].id, models[1].id] : []);
    setResponses([]);
    setTaskId(null);
    setErrorMessage(null);
    setWinnerResponseId(null);
    setVoteStatus("idle");
    setVoteMessage(null);
  }

  async function handleSelectWinner(responseId: string) {
    if (!taskId) {
      setVoteStatus("error");
      setVoteMessage("Нельзя проголосовать: задача не была сохранена.");
      return;
    }

    setSavingVoteResponseId(responseId);
    setVoteStatus("saving");
    setVoteMessage(null);

    try {
      const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, winnerResponseId: responseId, voteType: "best" }),
      });

      const data = (await res.json()) as { status?: string; error?: { message?: string } };

      if (!res.ok || data.status !== "success") {
        setVoteStatus("error");
        setVoteMessage(data.error?.message ?? "Не удалось сохранить голос.");
      } else {
        setWinnerResponseId(responseId);
        setVoteStatus("success");
        setVoteMessage("Голос сохранён.");
      }
    } catch {
      setVoteStatus("error");
      setVoteMessage("Ошибка сети при сохранении голоса.");
    } finally {
      setSavingVoteResponseId(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (identityMode === "loading") {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
      </div>
    );
  }

  if (identityMode === "gate") {
    return (
      <AccessGate
        onContinueAsGuest={handleContinueAsGuest}
        isLoading={isCreatingGuest}
        errorMessage={guestCreateError}
      />
    );
  }

  const hasResponses = responses.length > 0;
  const canSaveWinner = hasResponses && !!taskId && voteStatus !== "success";

  return (
    <div className="grid gap-6">
      {identityMode === "guest" && guestInfo ? (
        <GuestCard info={guestInfo} onSignIn={() => { window.location.href = "/login"; }} />
      ) : null}

      {/* Form */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Кодовая задача</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Введите задачу, выберите язык, фреймворк и модели — получите решения для сравнения.
            </p>
          </div>
          <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-semibold text-violet-100">
            Code Arena
          </span>
        </div>

        <div className="mt-5">
          <ProgrammingContextForm
            language={language}
            framework={framework}
            onLanguageChange={(lang) => setLanguage(lang)}
            onFrameworkChange={(fw) => setFramework(fw)}
          />
        </div>

        <div className="mt-5 mb-2">
          <CodeTemplates
            onSelect={(text, lang) => {
              setPrompt(text);
              if (lang) {
                const validLangs = ["TypeScript","JavaScript","Python","SQL","Go","Rust","Java","C#","PHP","Ruby"];
                if (validLangs.includes(lang)) {
                  setLanguage(lang as CodeArenaLanguage);
                }
              }
            }}
          />
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <label className="block text-sm font-medium text-slate-200" htmlFor="code-prompt">
            Задача
          </label>
          <span
            className={`text-xs tabular-nums transition-colors ${
              prompt.length >= CODE_PROMPT_MAX_LENGTH
                ? "text-red-400"
                : prompt.length >= CODE_PROMPT_MAX_LENGTH * 0.85
                ? "text-amber-400"
                : "text-slate-500"
            }`}
          >
            {prompt.length} / {CODE_PROMPT_MAX_LENGTH.toLocaleString()}
          </span>
        </div>
        <textarea
          id="code-prompt"
          value={prompt}
          maxLength={CODE_PROMPT_MAX_LENGTH}
          onChange={(e) => setPrompt(e.target.value)}
          className="mt-2 min-h-32 w-full rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-white outline-none ring-0 transition placeholder:text-slate-500 focus:border-violet-300/60"
          placeholder="Например: напиши Next.js API route для отправки запроса в OpenRouter с обработкой ошибок"
        />

        <div className="mt-6">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-slate-200">Модели для сравнения</h3>
            <span className="text-xs text-slate-400">
              {modelsLoading ? "Загрузка..." : `Выбрано: ${selectedModelIds.length} / ${CODE_MODEL_MAX_SELECT}`}
            </span>
          </div>
          <div className="mt-3 grid gap-3">
            {modelsLoading ? (
              <>
                <div className="h-14 animate-pulse rounded-2xl bg-white/10" />
                <div className="h-14 animate-pulse rounded-2xl bg-white/10" />
              </>
            ) : models.length === 0 ? (
              <p className="text-sm text-slate-400">Нет доступных моделей для Code Arena.</p>
            ) : (
              models.map((model) => {
                const isSelected = selectedModelIds.includes(model.id);
                const isDisabled = !isSelected && selectedModelIds.length >= CODE_MODEL_MAX_SELECT;
                return (
                  <label
                    key={model.id}
                    className={`flex cursor-pointer items-center justify-between gap-4 rounded-2xl border bg-slate-950/45 p-4 transition ${
                      isDisabled
                        ? "cursor-not-allowed border-white/5 opacity-50"
                        : "border-white/10 hover:border-violet-300/40"
                    }`}
                  >
                    <span>
                      <span className="flex flex-wrap items-center gap-2 font-semibold text-white">
                        {model.name}
                        {model.badge ? (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">
                            {model.badge}
                          </span>
                        ) : null}
                      </span>
                      {model.description ? (
                        <span className="mt-0.5 block text-xs text-slate-400">{model.description}</span>
                      ) : null}
                    </span>
                    <input
                      checked={isSelected}
                      disabled={isDisabled}
                      onChange={() => handleToggleModel(model.id)}
                      type="checkbox"
                      className="h-5 w-5 shrink-0 accent-violet-500"
                    />
                  </label>
                );
              })
            )}
          </div>
        </div>

        {errorMessage ? (
          <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
            {errorMessage}
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            disabled={isLoading || modelsLoading}
            onClick={handleSubmit}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-violet-300/60 bg-violet-600 px-6 py-3 text-center text-sm font-extrabold leading-5 text-white shadow-lg shadow-violet-950/35 transition hover:border-violet-200 hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200 disabled:cursor-not-allowed disabled:border-slate-500/30 disabled:bg-slate-700 disabled:text-slate-200 disabled:shadow-none"
            type="button"
          >
            {isLoading ? "Получаем решения..." : "Запустить сравнение"}
          </button>
          <button
            disabled={isLoading || modelsLoading}
            onClick={handleReset}
            className="rounded-full border border-white/15 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
          >
            Очистить
          </button>
        </div>
      </section>

      {/* Results */}
      {isLoading ? (
        <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
          <p className="mb-4 text-sm font-semibold text-slate-300">Запрашиваем решения...</p>
          <div className="animate-pulse space-y-4">
            {selectedModelIds.map((id) => {
              const model = models.find((m) => m.id === id);
              return (
                <div key={id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 animate-ping rounded-full bg-violet-400" />
                    <span className="text-sm text-slate-400">{model?.name ?? "Модель"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : hasResponses ? (
        <section className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-white">
              Результаты
              <span className="ml-2 text-sm font-normal text-slate-400">
                {currentLanguage}{currentFramework ? ` · ${currentFramework}` : ""}
              </span>
            </h2>
            <div className="flex gap-2">
              {responses.filter((r) => r.status === "success").length > 0 && (
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100">
                  {responses.filter((r) => r.status === "success").length} успешно
                </span>
              )}
              {responses.filter((r) => r.status === "error").length > 0 && (
                <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-100">
                  {responses.filter((r) => r.status === "error").length} с ошибкой
                </span>
              )}
            </div>
          </div>
          {voteMessage ? (
            <div className={
              voteStatus === "error"
                ? "rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100"
                : voteStatus === "success"
                  ? "rounded-2xl border border-emerald-300/30 bg-emerald-500/10 p-4 text-sm text-emerald-100"
                  : "rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-sm text-slate-200"
            }>
              {voteMessage}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
            <span className="text-xs text-slate-400">{responses.length} моделей</span>
            <div className="flex gap-2">
              <button
                onClick={() => setBlindMode((v) => !v)}
                className={`inline-flex min-h-[44px] items-center justify-center rounded-full border px-3 text-xs font-semibold transition ${
                  blindMode && !winnerResponseId
                    ? "border-violet-400/50 bg-violet-500/20 text-violet-200"
                    : "border-white/15 text-slate-400 hover:border-white/30 hover:text-white"
                }`}
                type="button"
              >
                {blindMode && !winnerResponseId ? "🙈 Скрыто" : "👁 Открыто"}
              </button>
            </div>
          </div>
          {blindMode && !winnerResponseId && (
            <p className="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-2.5 text-xs text-violet-200">
              Режим слепого тестирования — имена скрыты до голосования.
            </p>
          )}
          {responses.map((response, index) => (
            <CodeResponseCard
              key={response.id}
              response={response}
              isWinner={winnerResponseId === response.id}
              canSaveWinner={canSaveWinner}
              isSavingWinner={savingVoteResponseId === response.id}
              isVoteLocked={voteStatus === "saving"}
              blindLabel={(blindMode && !winnerResponseId) ? (["Модель A", "Модель B", "Модель C"][index] ?? `Модель ${index + 1}`) : undefined}
              onSelectWinner={handleSelectWinner}
            />
          ))}
          {/* Code diff between first two successful responses */}
          <CodeDiffView responses={responses} blindMode={blindMode && !winnerResponseId} />
        </section>
      ) : null}
    </div>
  );
}
