/**
 * Available models configuration.
 *
 * v0.4 uses a hardcoded server allowlist for safety.
 * v0.5 will move this list to Supabase.
 *
 * Important naming rule:
 * - v0.4 model.id is the OpenRouter model key;
 * - v0.5+ public modelIds should become Supabase UUID values;
 * - the OpenRouter model key should stay server-side as models.model_key.
 */

import { ApiError } from "./utils";

export interface ArenaModel {
  id: string;
  name: string;
  role: string;
  provider: "openrouter";
  badge?: string;
  description?: string;
}

export const ALLOWED_MODELS: ArenaModel[] = [
  {
    id: "google/gemini-flash-1.5",
    name: "Gemini Flash 1.5",
    role: "Быстрый и точный",
    provider: "openrouter",
    badge: "Быстрый",
    description: "Скоростная модель Google для быстрых и чётких ответов.",
  },
  {
    id: "mistralai/mistral-small-3.1-24b-instruct",
    name: "Mistral Small 3.1",
    role: "Сбалансированный анализ",
    provider: "openrouter",
    badge: "Сбалансированный",
    description: "Сильная модель Mistral для глубокого анализа и рассуждений.",
  },
  {
    id: "meta-llama/llama-3.1-8b-instruct",
    name: "Llama 3.1 8B",
    role: "Открытая модель",
    provider: "openrouter",
    badge: "Open Source",
    description: "Открытая модель Meta - хороший баланс скорости и качества.",
  },
];

export function getAvailableModels(): ArenaModel[] {
  return ALLOWED_MODELS.map((model) => ({
    id: model.id,
    name: model.name,
    role: model.role,
    provider: model.provider,
    badge: model.badge,
    description: model.description,
  }));
}

export function validateModelAllowlist(modelIds: string[]): void {
  const allowedIds = new Set(ALLOWED_MODELS.map((model) => model.id));

  for (const modelId of modelIds) {
    if (!allowedIds.has(modelId)) {
      throw new ApiError(
        403,
        "MODEL_NOT_ALLOWED",
        "One or more selected models are not allowed"
      );
    }
  }
}

export function getModelById(modelId: string): ArenaModel | undefined {
  return ALLOWED_MODELS.find((model) => model.id === modelId);
}
