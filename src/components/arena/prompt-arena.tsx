"use client";

import { useMemo, useState } from "react";
import { arenaModels } from "@/data/mock-arena";
import { buildMockResponses } from "@/lib/arena/mock-responses";
import type { ArenaResponse } from "@/types/arena";
import { ArenaForm } from "./arena-form";
import { ArenaResults } from "./arena-results";

const MIN_PROMPT_LENGTH = 3;
const MIN_SELECTED_MODELS = 2;
const MAX_SELECTED_MODELS = 3;

export function PromptArena() {
  const [prompt, setPrompt] = useState("");
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([arenaModels[0].id, arenaModels[1].id]);
  const [responses, setResponses] = useState<ArenaResponse[]>([]);
  const [winnerResponseId, setWinnerResponseId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const selectedModels = useMemo(
    () => arenaModels.filter((model) => selectedModelIds.includes(model.id)),
    [selectedModelIds],
  );

  function validateForm() {
    const cleanPrompt = prompt.trim();

    if (cleanPrompt.length < MIN_PROMPT_LENGTH) {
      return "Введите задачу минимум из 3 символов.";
    }

    if (selectedModelIds.length < MIN_SELECTED_MODELS) {
      return "Для сравнения нужно выбрать минимум две модели.";
    }

    if (selectedModelIds.length > MAX_SELECTED_MODELS) {
      return "В Static UI MVP можно выбрать максимум три модели.";
    }

    return null;
  }

  function handleToggleModel(modelId: string) {
    setErrorMessage(null);
    setWinnerResponseId(null);
    setSelectedModelIds((currentIds) => {
      if (currentIds.includes(modelId)) {
        return currentIds.filter((id) => id !== modelId);
      }

      if (currentIds.length >= MAX_SELECTED_MODELS) {
        setErrorMessage("В MVP можно выбрать максимум три модели.");
        return currentIds;
      }

      return [...currentIds, modelId];
    });
  }

  function handleSubmit() {
    const validationError = validateForm();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    setResponses([]);
    setWinnerResponseId(null);

    window.setTimeout(() => {
      const mockResponses = buildMockResponses({
        prompt,
        selectedModels,
      });

      setResponses(mockResponses);
      setIsLoading(false);
    }, 700);
  }

  function handleReset() {
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
        selectedModelIds={selectedModelIds}
        models={arenaModels}
        isLoading={isLoading}
        errorMessage={errorMessage}
        onPromptChange={(value) => {
          setPrompt(value);
          setErrorMessage(null);
        }}
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
