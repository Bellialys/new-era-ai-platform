/**
 * Arena constants - shared between frontend and backend
 */

export const ARENA_CONSTANTS = {
  // Prompt validation
  PROMPT_MIN_LENGTH: 3,
  PROMPT_MAX_LENGTH: 8000,

  // Model selection
  MODEL_MIN_SELECT: 2,
  MODEL_MAX_SELECT: 3,

  // Timeout for OpenRouter requests
  OPENROUTER_TIMEOUT_MS: 30000,

  // Delay for mock responses (used in development)
  MOCK_RESPONSE_DELAY_MS: 700,
};

export const {
  PROMPT_MIN_LENGTH,
  PROMPT_MAX_LENGTH,
  MODEL_MIN_SELECT,
  MODEL_MAX_SELECT,
  OPENROUTER_TIMEOUT_MS,
  MOCK_RESPONSE_DELAY_MS,
} = ARENA_CONSTANTS;
