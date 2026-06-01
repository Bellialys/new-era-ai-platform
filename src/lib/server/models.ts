/**
 * Available models configuration
 * This will be moved to database (Supabase) in v0.5
 * For now, we use a hardcoded allowlist for security
 */

export interface ArenaModel {
  id: string;
  name: string;
  role: string;
  provider: "openrouter";
}

/**
 * Allowed models list (server-side only)
 * These are the only models that can be used in /api/compare
 * 
 * WARNING: If you add a model here, make sure it's available in OpenRouter
 * and you've tested the API call
 */
export const ALLOWED_MODELS: ArenaModel[] = [
  {
    id: "meta-llama/llama-2-70b-chat",
    name: "Llama 2 70B",
    role: "Balanced answer",
    provider: "openrouter",
  },
  {
    id: "mistralai/mistral-7b-instruct",
    name: "Mistral 7B",
    role: "Quick and concise",
    provider: "openrouter",
  },
  {
    id: "openai/gpt-3.5-turbo",
    name: "GPT-3.5 Turbo",
    role: "Creative and detailed",
    provider: "openrouter",
  },
];

/**
 * Get all available models (public endpoint response)
 */
export function getAvailableModels(): ArenaModel[] {
  return ALLOWED_MODELS.map((model) => ({
    id: model.id,
    name: model.name,
    role: model.role,
    provider: model.provider,
  }));
}

/**
 * Validate that all requested model IDs are in the allowlist
 * @throws Error if any model is not allowed
 */
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

/**
 * Get model by ID
 */
export function getModelById(modelId: string): ArenaModel | undefined {
  return ALLOWED_MODELS.find((m) => m.id === modelId);
}
