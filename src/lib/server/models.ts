/**
 * Available models configuration
 * This will be moved to database (Supabase) in v0.5
 * For now, we use a hardcoded allowlist for security
 *
 * IMPORTANT: Verify model IDs against OpenRouter before deploying:
 * curl https://openrouter.ai/api/v1/models -H "Authorization: Bearer $OPENROUTER_API_KEY"
 */

import type { ArenaModel } from "@/types/arena";
import { ApiError } from "./utils";

export const ALLOWED_MODELS: ArenaModel[] = [
  {
    id: "poolside/laguna-xs.2:free",
    name: "Laguna XS.2",
    role: "Coding / code-oriented",
    provider: "openrouter",
    badge: "Free Coding",
    description: "Бесплатная компактная code-oriented модель Poolside для быстрых coding-сравнений.",
  },
  {
    id: "poolside/laguna-m.1:free",
    name: "Laguna M.1",
    role: "Coding / code-oriented",
    provider: "openrouter",
    badge: "Free Coding",
    description: "Бесплатная code-oriented модель Poolside для задач по программированию.",
  },
  {
    id: "google/gemma-4-31b-it:free",
    name: "Gemma 4 31B",
    role: "Открытая general-модель",
    provider: "openrouter",
    badge: "Free",
    description: "Бесплатная модель Google Gemma для сравнения качества общих ответов.",
  },
  {
    id: "qwen/qwen3-next-80b-a3b-instruct:free",
    name: "Qwen3 Next 80B",
    role: "Сбалансированный instruct",
    provider: "openrouter",
    badge: "Free Limited",
    description: "Бесплатная instruct-модель Qwen; может чаще упираться в rate limit.",
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    name: "Nemotron 3 Ultra",
    role: "Глубокое рассуждение",
    provider: "openrouter",
    badge: "Free Unstable",
    description: "Бесплатная reasoning-модель NVIDIA; временно ниже в списке из-за нестабильных ответов.",
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
  const allowedIds = new Set(ALLOWED_MODELS.map((m) => m.id));

  for (const modelId of modelIds) {
    if (!allowedIds.has(modelId)) {
      throw new ApiError(
        403,
        "MODEL_NOT_ALLOWED",
        "One or more selected models are not allowed."
      );
    }
  }
}

export function getModelById(modelId: string): ArenaModel | undefined {
  return ALLOWED_MODELS.find((m) => m.id === modelId);
}
