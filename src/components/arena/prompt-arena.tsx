"use client";

import { useEffect, useRef, useState } from "react";
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

const MAX_MODELS_ERROR_MESSAGE = "В MVP можно выбрать максимум три модели.";
const ANONYMOUS_SESSION_STORAGE_KEY = "new-era-anonymous-session-id";

type VoteStatus = "idle" | "saving" | "success" | "error";

function getDefaultModelIds(models: ArenaModel[]) {
  return models.slice(0, MODEL_MAX_SELECT).map((model) => model.id);
}

function getOrCreateAnonymousSessionId() {
  const existingSessionId = window.localStorage.getItem(ANONYMOUS_SESSION_STORAGE_KEY);
  if (existingSessionId) {
    return existingSessionId;
  }

  const newSessionId = crypto.randomUUID();
  window.localStorage.setItem(ANONYMOUS_SESSION_STORAGE_KEY, newSessionId);
  return newSessionId;
}

export function PromptArena() {
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load available models on mount
  useEffect(() => {
    async function loadModels() {
      try {
        const response = await fetch("/api/models");
        if (!response.ok) {
          throw new Error("Failed to load models");
        }
        const data = (await response.json()) as {
          status: string;
          models: ArenaModel[];
        };
        setAvailableModels(data.models);
        // Select the recommended MVP set by default.
        if (data.models.length >= MODEL_MIN_SELECT) {
          setSelectedModelIds(getDefaultModelIds(data.models));
        }
      } catch (error) {
        console.error("Error loading models:", error);
        setModelsError(
          "Не удалось загрузить список моделей. Обновите страницу."
        );
      } finally {
        setModelsLoading(false);
      }
    }

    loadModels();
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  function buildResponseViews(apiResponses: ArenaApiResponse[]): ArenaResponseView[] {
    return apiResponses.map((response) => {
      const matchedModel = availableModels.find(
        (model) => model.id === response.modelId
      );

      return {
        ...response,
        modelRole: matchedModel?.role ?? "Unknown model role",
      };
    });
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
    setSavingVoteResponseId(null);
    setIsLoading(false);
  }

  function validateForm() {
    const cleanPrompt = prompt.trim();

    if (cleanPrompt.length < PROMPT_MIN_LENGTH) {
      return "Введите задачу минимум из 3 символов.";
    }

    if (cleanPrompt.length > PROMPT_MAX_LENGTH) {
      return `Введите задачу не длиннее ${PROMPT_MAX_LENGTH} символов.`;
    }

    if (selectedModelIds.length < MODEL_MIN_SELECT) {
      return "Для сравнения нужно выбрать минимум две модели.";
    }

    if (selectedModelIds.length > MODEL_MAX_SELECT) {
      return MAX_MODELS_ERROR_MESSAGE;
    }

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

    // Call the real API
    (async () => {
      try {
        const response = await fetch("/api/compare", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: prompt.trim(),
            modelIds: selectedModelIds,
            modeSlug: "prompt-arena",
          }),
          signal: abortController.signal,
        });

        // Check if this response is still relevant
        if (requestIdRef.current !== requestId) {
          return;
        }

        if (!response.ok) {
          const errorData = (await response.json()) as {
            message?: string;
            errorCode?: string;
          };
          throw new Error(
            errorData.message || `API error: ${response.status}`
          );
        }

        const data = (await response.json()) as {
          status: string;
          taskId?: string | null;
          responses: ArenaApiResponse[];
        };

        if (!data.responses) {
          throw new Error("Invalid API response format");
        }

        setTaskId(data.taskId ?? null);
        setResponses(buildResponseViews(data.responses));
        if (!data.taskId) {
          setVoteStatus("error");
          setVoteMessage(
            "Winner voting недоступен: сравнение не сохранено в Supabase."
          );
        }
      } catch (error) {
        if (requestIdRef.current !== requestId) {
          return;
        }

        console.error("Error fetching responses:", error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Не удалось получить ответы. Попробуйте ещё раз."
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
      setVoteMessage(
        "Winner voting недоступен: сравнение не сохранено в Supabase."
      );
      return;
    }

    setVoteStatus("saving");
    setVoteMessage("Сохраняем Winner vote...");
    setSavingVoteResponseId(responseId);

    try {
      const response = await fetch("/api/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId,
          responseId,
          voteType: "best",
          anonymousSessionId: getOrCreateAnonymousSessionId(),
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as {
          message?: string;
        };
        throw new Error(errorData.message || "Не удалось сохранить Winner vote.");
      }

      setWinnerResponseId(responseId);
      setVoteStatus("success");
      setVoteMessage("Winner vote сохранён.");
    } catch (error) {
      console.error("Error saving winner vote:", error);
      setVoteStatus("error");
      setVoteMessage(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить Winner vote."
      );
    } finally {
      setSavingVoteResponseId(null);
    }
  }

  function handleReset() {
    requestIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setPrompt("");
    // Reset to the recommended MVP set.
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

  return (
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
        onSelectWinner={handleSelectWinner}
      />
    </section>
  );
}
