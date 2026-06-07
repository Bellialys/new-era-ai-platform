/**
 * Available models configuration
 * This will be moved to database (Supabase) in v0.5
 * For now, we use a hardcoded allowlist for security
 *
 * IMPORTANT: Verify model IDs against OpenRouter before deploying:
 * curl https://openrouter.ai/api/v1/models -H "Authorization: Bearer $OPENROUTER_API_KEY"
 */

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
    id: "google/gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    role: "Быстрый и точный",
    provider: "openrouter",
    badge: "Быстрый",
    description: "Актуальная скоростная модель Google для быстрых и чётких ответов.",
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
    description: "Открытая модель Meta — хороший баланс скорости и качества.",
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
      throw new Error(
        `Model "${modelId}" is not in the allowed models list. Allowed models: ${Array.from(allowedIds).join(", ")}`
      );
    }
  }
}

export function getModelById(modelId: string): ArenaModel | undefined {
  return ALLOWED_MODELS.find((m) => m.id === modelId);
}
