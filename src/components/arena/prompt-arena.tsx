"use client";

import { useMemo, useRef, useState } from "react";
import { arenaModels } from "@/data/mock-arena";
import { buildMockResponses } from "@/lib/arena/mock-responses";
import type { ArenaApiResponse, ArenaResponseView } from "@/types/arena";
import { ArenaForm } from "./arena-form";
import { ArenaResults } from "./arena-results";

const MIN_PROMPT_LENGTH = 3;
const MAX_PROMPT_LENGTH = 8000;
const MIN_SELECTED_MODELS = 2;
const MAX_SELECTED_MODELS = 3;
const MAX_MODELS_ERROR_MESSAGE = "В MVP можно выбрать максимум три модели.";

export function PromptArena() {
  const [prompt, setPrompt] = useState("");
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([arenaModels[0].id, arenaModels[1].id]);
  const [responses, setResponses] = useState<ArenaResponseView[]>([]);
  const [winnerResponseId, setWinnerResponseId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);

  const selectedModels = useMemo(
    () => arenaModels.filter((model) => selectedModelIds.includes(model.id)),
    [selectedModelIds],
  );

  function buildResponseViews(apiResponses: ArenaApiResponse[]): ArenaResponseView[] {
    return apiResponses.map((response) => {
      const matchedModel = arenaModels.find((model) => model.id === response.modelId);

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

    if (cleanPrompt.length < MIN_PROMPT_LENGTH) {
      return "Введите задачу минимум из 3 символов.";
    }

    if (cleanPrompt.length > MAX_PROMPT_LENGTH) {
      return `Введите задачу не длиннее ${MAX_PROMPT_LENGTH} символов.`;
    }

    if (selectedModelIds.length < MIN_SELECTED_MODELS) {
      return "Для сравнения нужно выбрать минимум две модели.";
    }

    if (selectedModelIds.length > MAX_SELECTED_MODELS) {
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

      if (currentIds.length >= MAX_SELECTED_MODELS) {
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

    window.setTimeout(() => {
      if (requestIdRef.current !== requestId) {
        return;
      }

      const mockResponses = buildMockResponses({
        prompt,
        selectedModels,
      });

      setResponses(buildResponseViews(mockResponses));
      setIsLoading(false);
    }, 700);
  }

  function handleReset() {
    requestIdRef.current += 1;
    setPrompt("");
    setSelectedModelIds([arenaModels[0].id, arenaModels[1].id]);
    setResponses([]);
    setWinnerResponseId(null);
    setErrorMessage(null);
    setIsLoading(false);
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <ArenaForm
        prompt={prompt}
        maxPromptLength={MAX_PROMPT_LENGTH}
        selectedModelIds={selectedModelIds}
        models={arenaModels}
        isLoading={isLoading}
        errorMessage={errorMessage}
        onPromptChange={handlePromptChange}
        onToggleModel={handleToggleModel}
        onSubmit={handleSubmit}
        onReset={handleReset}
      />

      <ArenaResults
        responses={responses}
        isLoading={isLoading}
        winnerResponseId={winnerResponseId}
        onSelectWinner={setWinnerResponseId}
      />
    </section>
  );
}
