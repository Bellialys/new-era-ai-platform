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

export function PromptArena() {
  const [availableModels, setAvailableModels] = useState<ArenaModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const [prompt, setPrompt] = useState("");
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [responses, setResponses] = useState<ArenaResponseView[]>([]);
  const [winnerResponseId, setWinnerResponseId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);

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
        // Select first two models by default
        if (data.models.length >= 2) {
          setSelectedModelIds([data.models[0].id, data.models[1].id]);
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
    setResponses([]);
    setWinnerResponseId(null);
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

    setErrorMessage(null);
    setIsLoading(true);
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
          responses: ArenaApiResponse[];
        };

        if (!data.responses) {
          throw new Error("Invalid API response format");
        }

        setResponses(buildResponseViews(data.responses));
      } catch (error) {
        console.error("Error fetching responses:", error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Не удалось получить ответы. Попробуйте ещё раз."
        );
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    })();
  }

  function handleReset() {
    requestIdRef.current += 1;
    setPrompt("");
    // Reset to first two models (or default)
    if (availableModels.length >= 2) {
      setSelectedModelIds([
        availableModels[0].id,
        availableModels[1].id,
      ]);
    } else {
      setSelectedModelIds([]);
    }
    setResponses([]);
    setWinnerResponseId(null);
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
        onSelectWinner={setWinnerResponseId}
      />
    </section>
  );
}
