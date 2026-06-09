/**
 * Hardcoded model list — the offline fallback for the model catalog.
 *
 * In v0.5.3 the live catalog is read from Supabase (see model-catalog.ts). This
 * list is used only when Supabase is not configured or the `models` table is
 * empty, so the app still works without a database.
 *
 * TODO(v0.5.3): verify model IDs against OpenRouter before public deploy:
 * curl https://openrouter.ai/api/v1/models -H "Authorization: Bearer $OPENROUTER_API_KEY"
 */

import type { ArenaModel } from "@/types/arena";

// Curated set of free OpenRouter text/chat model keys mirrored by
// supabase/migrations/0002_sync_free_models.sql. The keys must be verified
// against OpenRouter before public deploy; this repository does not store an
// API key and should not claim live verification without running that check.
// Order matters: the UI preselects the first models.
export const ALLOWED_MODELS: ArenaModel[] = [
  // --- General-purpose (default selection) ---
  {
    id: "openai/gpt-oss-120b:free",
    name: "GPT-OSS 120B",
    role: "Сильная general-модель",
    provider: "openrouter",
    badge: "Free",
    description: "Бесплатная открытая модель OpenAI на 120B — сильный универсальный baseline.",
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B",
    role: "Сбалансированный instruct",
    provider: "openrouter",
    badge: "Free",
    description: "Бесплатная instruct-модель Meta 70B — хороший баланс качества и скорости.",
  },
  {
    id: "qwen/qwen3-next-80b-a3b-instruct:free",
    name: "Qwen3 Next 80B",
    role: "Сбалансированный instruct",
    provider: "openrouter",
    badge: "Free",
    description: "Бесплатная instruct-модель Qwen 80B с большим контекстом.",
  },
  {
    id: "google/gemma-4-31b-it:free",
    name: "Gemma 4 31B",
    role: "Открытая general-модель",
    provider: "openrouter",
    badge: "Free",
    description: "Бесплатная модель Google Gemma 4 для общих ответов, контекст 262K.",
  },
  {
    id: "google/gemma-4-26b-a4b-it:free",
    name: "Gemma 4 26B A4B",
    role: "Открытая general-модель (MoE)",
    provider: "openrouter",
    badge: "Free",
    description: "Бесплатная MoE-модель Google Gemma 4 — быстрее за счёт активных 4B параметров.",
  },
  {
    id: "z-ai/glm-4.5-air:free",
    name: "GLM 4.5 Air",
    role: "Лёгкая general-модель",
    provider: "openrouter",
    badge: "Free",
    description: "Бесплатная облегчённая модель Z.ai GLM для быстрых общих ответов.",
  },
  {
    id: "moonshotai/kimi-k2.6:free",
    name: "Kimi K2.6",
    role: "General + длинный контекст",
    provider: "openrouter",
    badge: "Free",
    description: "Бесплатная модель MoonshotAI Kimi с контекстом 262K для длинных задач.",
  },
  {
    id: "nousresearch/hermes-3-llama-3.1-405b:free",
    name: "Hermes 3 405B",
    role: "Крупная general-модель",
    provider: "openrouter",
    badge: "Free",
    description: "Бесплатная 405B-модель Nous Research на базе Llama 3.1.",
  },
  {
    id: "openai/gpt-oss-20b:free",
    name: "GPT-OSS 20B",
    role: "Быстрая general-модель",
    provider: "openrouter",
    badge: "Free Fast",
    description: "Бесплатная компактная открытая модель OpenAI 20B для быстрых ответов.",
  },
  {
    id: "meta-llama/llama-3.2-3b-instruct:free",
    name: "Llama 3.2 3B",
    role: "Быстрая лёгкая модель",
    provider: "openrouter",
    badge: "Free Fast",
    description: "Бесплатная компактная модель Meta 3B — очень быстрая, для простых задач.",
  },

  // --- Reasoning ---
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    name: "Nemotron 3 Ultra",
    role: "Глубокое рассуждение",
    provider: "openrouter",
    badge: "Free Reasoning",
    description: "Бесплатная reasoning-модель NVIDIA 550B с контекстом 1M.",
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    name: "Nemotron 3 Super",
    role: "Рассуждение",
    provider: "openrouter",
    badge: "Free Reasoning",
    description: "Бесплатная reasoning-модель NVIDIA 120B, контекст 1M.",
  },
  {
    id: "nvidia/nemotron-3-nano-30b-a3b:free",
    name: "Nemotron 3 Nano 30B",
    role: "Лёгкое рассуждение",
    provider: "openrouter",
    badge: "Free Reasoning",
    description: "Бесплатная компактная reasoning-модель NVIDIA 30B.",
  },
  {
    id: "nvidia/nemotron-nano-9b-v2:free",
    name: "Nemotron Nano 9B",
    role: "Быстрое рассуждение",
    provider: "openrouter",
    badge: "Free Fast",
    description: "Бесплатная маленькая reasoning-модель NVIDIA 9B для быстрых ответов.",
  },

  // --- Coding ---
  {
    id: "qwen/qwen3-coder:free",
    name: "Qwen3 Coder 480B",
    role: "Coding / code-oriented",
    provider: "openrouter",
    badge: "Free Coding",
    description: "Бесплатная крупная code-модель Qwen3 Coder 480B с контекстом 1M.",
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
    id: "poolside/laguna-xs.2:free",
    name: "Laguna XS.2",
    role: "Coding / code-oriented",
    provider: "openrouter",
    badge: "Free Coding",
    description: "Бесплатная компактная code-oriented модель Poolside для быстрых coding-сравнений.",
  },

  // --- Compact / experimental ---
  {
    id: "liquid/lfm-2.5-1.2b-instruct:free",
    name: "LFM 2.5 1.2B",
    role: "Сверхбыстрая лёгкая модель",
    provider: "openrouter",
    badge: "Free Fast",
    description: "Бесплатная очень маленькая instruct-модель LiquidAI 1.2B для мгновенных ответов.",
  },
];

export function getModelById(modelId: string): ArenaModel | undefined {
  return ALLOWED_MODELS.find((m) => m.id === modelId);
}
