"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  PROMPT_MIN_LENGTH,
  PROMPT_MAX_LENGTH,
  MODEL_MIN_SELECT,
  MODEL_MAX_SELECT,
} from "@/lib/arena/constants";
import type {
  ArenaApiResponse,
  ArenaResponseView,
  ArenaModel,
} from "@/types/arena";
import { ArenaForm } from "./arena-form";
import { ArenaResults } from "./arena-results";
import { AccessGate } from "./access-gate";
import { UsageIndicator } from "./usage-indicator";
import { GuestSessionCard } from "./guest-session-card";
import { useArenaIdentity } from "./use-arena-identity";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VoteStatus = "idle" | "saving" | "success" | "error";

type CompareStreamEventName =
  | "model_start"
  | "model_token"
  | "model_done"
  | "model_error"
  | "complete"
  | "fatal_error";

type CompareStreamEvent = {
  event: CompareStreamEventName;
  data: unknown;
};

type ModelStartPayload = {
  modelId: string;
  modelName: string;
  modelRole: string;
};

type ModelTokenPayload = {
  modelId: string;
  token: string;
};

type ModelResultPayload = {
  modelId: string;
  response: ArenaApiResponse;
};

type CompareCompletePayload = {
  status: string;
  taskId?: string | null;
  responses: ArenaApiResponse[];
};

type ApiErrorPayload = {
  message?: string;
  errorCode?: string;
};

// ---------------------------------------------------------------------------
// PromptArena
// ---------------------------------------------------------------------------

const MAX_MODELS_ERROR_MESSAGE = `Можно выбрать максимум ${MODEL_MAX_SELECT} моделей.`;

function getDefaultModelIds(models: ArenaModel[]) {
  return models.slice(0, MODEL_MAX_SELECT).map((model) => model.id);
}

function parseStreamEvent(rawEvent: string): CompareStreamEvent | null {
  const eventLine = rawEvent
    .split(/\r?\n/)
    .find((line) => line.startsWith("event:"));
  const dataLines = rawEvent
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart());

  if (!eventLine || dataLines.length === 0) {
    return null;
  }

  const event = eventLine.slice("event:".length).trim() as CompareStreamEventName;
  try {
    return {
      event,
      data: JSON.parse(dataLines.join("\n")) as unknown,
    };
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asModelStartPayload(value: unknown): ModelStartPayload | null {
  if (!isObject(value)) return null;
  if (
    typeof value.modelId !== "string" ||
    typeof value.modelName !== "string" ||
    typeof value.modelRole !== "string"
  ) {
    return null;
  }

  return {
    modelId: value.modelId,
    modelName: value.modelName,
    modelRole: value.modelRole,
  };
}

function asModelTokenPayload(value: unknown): ModelTokenPayload | null {
  if (!isObject(value)) return null;
  if (typeof value.modelId !== "string" || typeof value.token !== "string") {
    return null;
  }

  return {
    modelId: value.modelId,
    token: value.token,
  };
}

function asArenaApiResponse(value: unknown): ArenaApiResponse | null {
  if (!isObject(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.modelId !== "string" ||
    typeof value.modelName !== "string" ||
    (value.status !== "success" && value.status !== "error")
  ) {
    return null;
  }

  return {
    id: value.id,
    modelId: value.modelId,
    modelName: value.modelName,
    status: value.status,
    answerText: typeof value.answerText === "string" ? value.answerText : null,
    latencyMs: typeof value.latencyMs === "number" ? value.latencyMs : undefined,
    errorCode: typeof value.errorCode === "string" ? value.errorCode : undefined,
    errorMessage: typeof value.errorMessage === "string" ? value.errorMessage : undefined,
  };
}

function asModelResultPayload(value: unknown): ModelResultPayload | null {
  if (!isObject(value) || typeof value.modelId !== "string") return null;
  const response = asArenaApiResponse(value.response);
  if (!response) return null;

  return {
    modelId: value.modelId,
    response,
  };
}

function asCompletePayload(value: unknown): CompareCompletePayload | null {
  if (!isObject(value) || !Array.isArray(value.responses)) return null;
  const responses = value.responses
    .map((response) => asArenaApiResponse(response))
    .filter((response): response is ArenaApiResponse => Boolean(response));

  return {
    status: typeof value.status === "string" ? value.status : "error",
    taskId: typeof value.taskId === "string" ? value.taskId : null,
    responses,
  };
}

function asApiErrorPayload(value: unknown): ApiErrorPayload {
  if (!isObject(value)) return {};
  return {
    message: typeof value.message === "string" ? value.message : undefined,
    errorCode: typeof value.errorCode === "string" ? value.errorCode : undefined,
  };
}

export function PromptArena() {
  const {
    identityMode,
    guestInfo,
    guestCreateError,
    isCreatingGuest,
    continueAsGuest,
    signIn,
    resetToGate,
  } = useArenaIdentity();

  // --- Arena state ---
  const [availableModels, setAvailableModels] = useState<ArenaModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const [prompt, setPrompt] = useState("");
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [responses, setResponses] = useState<ArenaResponseView[]>([]);
  const [winnerResponseId, setWinnerResponseId] = useState<string | null>(null);
  const [voteStatus, setVoteStatus] = useState<VoteStatus>("idle");
  const [voteMessage, setVoteMessage] = useState<string | null>(null);
  const [savingVoteResponseId, setSavingVoteResponseId] = useState<string | null>(null);
  const [blindMode, setBlindMode] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionWins, setSessionWins] = useState<Record<string, number>>({});
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Abort pending requests on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Load models
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (identityMode === "loading" || identityMode === "gate") return;

    async function loadModels() {
      setModelsLoading(true);
      try {
        const response = await fetch("/api/models");
        if (!response.ok) throw new Error("Failed to load models");
        const data = (await response.json()) as {
          status: string;
          models: ArenaModel[];
        };
        setAvailableModels(data.models);
        if (data.models.length >= MODEL_MIN_SELECT) {
          setSelectedModelIds(getDefaultModelIds(data.models));
        }
      } catch (error) {
        console.error("Error loading models:", error);
        setModelsError("Не удалось загрузить список моделей. Обновите страницу.");
      } finally {
        setModelsLoading(false);
      }
    }

    loadModels();
  }, [identityMode]);

  // ---------------------------------------------------------------------------
  // Arena helpers
  // ---------------------------------------------------------------------------

  function buildResponseView(
    apiResponse: ArenaApiResponse,
    fallbackRole?: string
  ): ArenaResponseView {
    const matchedModel = availableModels.find((model) => model.id === apiResponse.modelId);
    return {
      ...apiResponse,
      modelRole: fallbackRole ?? matchedModel?.role ?? "Unknown model role",
      isStreaming: false,
    };
  }

  function buildResponseViews(apiResponses: ArenaApiResponse[]): ArenaResponseView[] {
    return apiResponses.map((response) => buildResponseView(response));
  }

  function upsertStreamingResponse(payload: ModelStartPayload) {
    setResponses((currentResponses) => {
      const existingIndex = currentResponses.findIndex(
        (response) => response.modelId === payload.modelId
      );
      const streamingResponse: ArenaResponseView = {
        id: `stream-${payload.modelId}`,
        modelId: payload.modelId,
        modelName: payload.modelName,
        modelRole: payload.modelRole,
        status: "success",
        answerText: "",
        isStreaming: true,
      };

      if (existingIndex === -1) {
        return [...currentResponses, streamingResponse];
      }

      return currentResponses.map((response, index) =>
        index === existingIndex ? { ...response, ...streamingResponse } : response
      );
    });
  }

  function appendStreamingToken(payload: ModelTokenPayload) {
    setResponses((currentResponses) =>
      currentResponses.map((response) =>
        response.modelId === payload.modelId
          ? {
              ...response,
              answerText: `${response.answerText ?? ""}${payload.token}`,
              isStreaming: true,
            }
          : response
      )
    );
  }

  function finishStreamingResponse(payload: ModelResultPayload) {
    setResponses((currentResponses) => {
      const existing = currentResponses.find(
        (response) => response.modelId === payload.modelId
      );
      const nextResponse = buildResponseView(payload.response, existing?.modelRole);

      if (!existing) {
        return [...currentResponses, nextResponse];
      }

      return currentResponses.map((response) =>
        response.modelId === payload.modelId ? nextResponse : response
      );
    });
  }

  function applyCompareStreamEvent(streamEvent: CompareStreamEvent): string | null {
    switch (streamEvent.event) {
      case "model_start": {
        const payload = asModelStartPayload(streamEvent.data);
        if (payload) upsertStreamingResponse(payload);
        return null;
      }
      case "model_token": {
        const payload = asModelTokenPayload(streamEvent.data);
        if (payload) appendStreamingToken(payload);
        return null;
      }
      case "model_done":
      case "model_error": {
        const payload = asModelResultPayload(streamEvent.data);
        if (payload) finishStreamingResponse(payload);
        return null;
      }
      case "complete": {
        const payload = asCompletePayload(streamEvent.data);
        if (!payload) return "Invalid streaming completion payload.";

        setTaskId(payload.taskId ?? null);
        setResponses(buildResponseViews(payload.responses));
        if (!payload.taskId) {
          setVoteStatus("error");
          setVoteMessage("Winner voting недоступен: сравнение не сохранено в Supabase.");
        }
        return null;
      }
      case "fatal_error": {
        const payload = asApiErrorPayload(streamEvent.data);
        return payload.message ?? "Streaming comparison failed.";
      }
      default:
        return null;
    }
  }

  async function readCompareStream(response: Response, requestId: number) {
    if (!response.body) {
      throw new Error("Streaming response body is empty.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      if (requestIdRef.current !== requestId) {
        await reader.cancel();
        return;
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";

      for (const rawEvent of events) {
        const streamEvent = parseStreamEvent(rawEvent);
        if (!streamEvent) continue;

        const fatalError = applyCompareStreamEvent(streamEvent);
        if (fatalError) {
          throw new Error(fatalError);
        }
      }
    }
  }

  function clearStaleResults() {
    requestIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setTaskId(null);
    setResponses([]);
    setWinnerResponseId(null);
    setVoteStatus("idle");
    setVoteMessage(null);
    setBlindMode(true);
    setSavingVoteResponseId(null);
    setIsLoading(false);
  }

  function validateForm() {
    const cleanPrompt = prompt.trim();
    if (cleanPrompt.length < PROMPT_MIN_LENGTH) return "Введите задачу минимум из 3 символов.";
    if (cleanPrompt.length > PROMPT_MAX_LENGTH) return `Введите задачу не длиннее ${PROMPT_MAX_LENGTH} символов.`;
    if (selectedModelIds.length < MODEL_MIN_SELECT) return "Для сравнения нужно выбрать минимум две модели.";
    if (selectedModelIds.length > MODEL_MAX_SELECT) return MAX_MODELS_ERROR_MESSAGE;
    return null;
  }

  function handlePromptChange(value: string) {
    setPrompt(value);
    setErrorMessage(null);
    clearStaleResults();
  }

  function handleToggleModel(modelId: string) {
    setErrorMessage(null);
    setSelectedModelIds((currentIds) => {
      if (currentIds.includes(modelId)) {
        clearStaleResults();
        return currentIds.filter((id) => id !== modelId);
      }
      if (currentIds.length >= MODEL_MAX_SELECT) {
        setErrorMessage(MAX_MODELS_ERROR_MESSAGE);
        return currentIds;
      }
      clearStaleResults();
      return [...currentIds, modelId];
    });
  }

  function handleSubmit() {
    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setErrorMessage(null);
    setVoteStatus("idle");
    setVoteMessage(null);
    setSavingVoteResponseId(null);
    setIsLoading(true);
    setTaskId(null);
    setResponses([]);
    setWinnerResponseId(null);

    (async () => {
      try {
        const response = await fetch("/api/stream-compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: prompt.trim(),
            modelIds: selectedModelIds,
            modeSlug: "prompt-arena",
            stream: true,
          }),
          signal: abortController.signal,
        });

        if (requestIdRef.current !== requestId) return;

        if (!response.ok) {
          const errorData = (await response.json()) as { message?: string; errorCode?: string };
          // If auth expired mid-session, go back to gate
          if (response.status === 401) {
            resetToGate();
          }
          throw new Error(errorData.message || `API error: ${response.status}`);
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("text/event-stream")) {
          await readCompareStream(response, requestId);
          return;
        }

        const data = (await response.json()) as {
          status: string;
          taskId?: string | null;
          responses: ArenaApiResponse[];
        };

        if (!data.responses) throw new Error("Invalid API response format");

        setTaskId(data.taskId ?? null);
        setResponses(buildResponseViews(data.responses));
        if (!data.taskId) {
          setVoteStatus("error");
          setVoteMessage("Winner voting недоступен: сравнение не сохранено в Supabase.");
        }
      } catch (error) {
        if (requestIdRef.current !== requestId) return;
        console.error("Error fetching responses:", error);
        setErrorMessage(
          error instanceof Error ? error.message : "Не удалось получить ответы. Попробуйте ещё раз."
        );
      } finally {
        if (requestIdRef.current === requestId) {
          abortControllerRef.current = null;
          setIsLoading(false);
        }
      }
    })();
  }

  async function handleSelectWinner(responseId: string) {
    if (!taskId) {
      setVoteStatus("error");
      setVoteMessage("Winner voting недоступен: сравнение не сохранено в Supabase.");
      return;
    }

    setVoteStatus("saving");
    setVoteMessage("Сохраняем Winner vote...");
    setSavingVoteResponseId(responseId);

    try {
      const response = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, responseId, voteType: "best" }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as { message?: string };
        throw new Error(errorData.message || "Не удалось сохранить Winner vote.");
      }

      setWinnerResponseId(responseId);
      const winnerModel = responses.find((r) => r.id === responseId);
      if (winnerModel) {
        setSessionWins((prev) => ({
          ...prev,
          [winnerModel.modelId]: (prev[winnerModel.modelId] ?? 0) + 1,
        }));
      }
      setVoteStatus("success");
      setVoteMessage("Winner vote сохранён.");
    } catch (error) {
      console.error("Error saving winner vote:", error);
      setVoteStatus("error");
      setVoteMessage(
        error instanceof Error ? error.message : "Не удалось сохранить Winner vote."
      );
    } finally {
      setSavingVoteResponseId(null);
    }
  }

  function handleSetSelectedModelIds(ids: string[]) {
    clearStaleResults();
    setErrorMessage(null);
    setSelectedModelIds(ids);
  }

  function handleReset() {
    requestIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setPrompt("");
    if (availableModels.length >= MODEL_MIN_SELECT) {
      setSelectedModelIds(getDefaultModelIds(availableModels));
    } else {
      setSelectedModelIds([]);
    }
    setTaskId(null);
    setResponses([]);
    setWinnerResponseId(null);
    setVoteStatus("idle");
    setVoteMessage(null);
    setSavingVoteResponseId(null);
    setErrorMessage(null);
    setIsLoading(false);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Loading identity
  if (identityMode === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <svg className="h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Загружаем…</span>
        </div>
      </div>
    );
  }

  // Access Gate — no identity yet
  if (identityMode === "gate") {
    return (
      <AccessGate
        onContinueAsGuest={continueAsGuest}
        isLoading={isCreatingGuest}
        errorMessage={guestCreateError}
      />
    );
  }

  // Arena — user or guest
  return (
    <div>
      {/* Guest card */}
      {identityMode === "guest" && guestInfo && (
        <GuestSessionCard info={guestInfo} onSignIn={signIn} />
      )}

      {/* User indicator */}
      {identityMode === "user" && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-sm text-emerald-300">Вы вошли в аккаунт</span>
          <Link
            href="/profile"
            className="ml-auto text-xs text-slate-400 transition hover:text-white"
          >
            Профиль →
          </Link>
        </div>
      )}

      {/* Usage indicator */}
      <UsageIndicator />

      {/* Arena form + results */}
      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <ArenaForm
          prompt={prompt}
          maxPromptLength={PROMPT_MAX_LENGTH}
          selectedModelIds={selectedModelIds}
          models={availableModels}
          modelsLoading={modelsLoading}
          isLoading={isLoading}
          errorMessage={errorMessage || modelsError}
          onPromptChange={handlePromptChange}
          onToggleModel={handleToggleModel}
          onSetSelectedModelIds={handleSetSelectedModelIds}
          onSubmit={handleSubmit}
          onReset={handleReset}
        />

        <ArenaResults
          responses={responses}
          isLoading={isLoading}
          loadingModelNames={availableModels
            .filter((m) => selectedModelIds.includes(m.id))
            .map((m) => m.name)}
          winnerResponseId={winnerResponseId}
          canSaveWinner={Boolean(taskId)}
          voteStatus={voteStatus}
          voteMessage={voteMessage}
          savingVoteResponseId={savingVoteResponseId}
          prompt={prompt}
          taskId={taskId}
          blindMode={blindMode}
          sessionWins={sessionWins}
          allModels={availableModels}
          onToggleBlindMode={() => setBlindMode((v) => !v)}
          onSelectWinner={handleSelectWinner}
        />
      </section>
    </div>
  );
}
