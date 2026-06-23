/**
 * Arena constants - shared between frontend and backend
 */

export const ARENA_CONSTANTS = {
  PROMPT_MIN_LENGTH: 3,
  PROMPT_MAX_LENGTH: 8000,
  MODEL_MIN_SELECT: 2,
  MODEL_MAX_SELECT: 3,
  OPENROUTER_TIMEOUT_MS: 60000,
  // 2048 tokens covers most conversational responses without cutting off mid-sentence.
  OPENROUTER_MAX_TOKENS: 2048,
  COMPARE_RATE_LIMIT_WINDOW_MS: 60_000,
  COMPARE_RATE_LIMIT_MAX_REQUESTS: 10,
  VOTE_RATE_LIMIT_WINDOW_MS: 60_000,
  VOTE_RATE_LIMIT_MAX_REQUESTS: 30,
  // GET /api/models is a cheap read; 60 req/min is generous but prevents scraping.
  MODELS_RATE_LIMIT_WINDOW_MS: 60_000,
  MODELS_RATE_LIMIT_MAX_REQUESTS: 60,
  // History is a cheap authenticated read; mirror the models budget.
  HISTORY_RATE_LIMIT_WINDOW_MS: 60_000,
  HISTORY_RATE_LIMIT_MAX_REQUESTS: 60,
  HISTORY_PAGE_SIZE_DEFAULT: 20,
  HISTORY_PAGE_SIZE_MAX: 50,
  // Code Arena Lite constants (v0.7)
  CODE_COMPARE_RATE_LIMIT_WINDOW_MS: 60_000,
  CODE_COMPARE_RATE_LIMIT_MAX_REQUESTS: 8,
  CODE_PROMPT_MIN_LENGTH: 10,
  CODE_PROMPT_MAX_LENGTH: 6000,
  CODE_MODEL_MIN_SELECT: 2,
  CODE_MODEL_MAX_SELECT: 3,
};

export const MODE_SLUG_PROMPT_ARENA = "prompt-arena";
export const MODE_SLUG_CODE_ARENA = "code-arena";
export const ALLOWED_MODE_SLUGS = [MODE_SLUG_PROMPT_ARENA, MODE_SLUG_CODE_ARENA] as const;

export type ArenaModeSlug = (typeof ALLOWED_MODE_SLUGS)[number];

// Code Arena supported languages and frameworks (v0.7)
export const CODE_ARENA_LANGUAGES = [
  "TypeScript",
  "JavaScript",
  "Python",
  "SQL",
  "Go",
  "Rust",
  "Java",
  "C#",
  "PHP",
  "Ruby",
] as const;

export type CodeArenaLanguage = (typeof CODE_ARENA_LANGUAGES)[number];

export const CODE_ARENA_FRAMEWORKS: Record<string, string[]> = {
  TypeScript: ["Next.js", "React", "Express", "NestJS", "Supabase", "Bun"],
  JavaScript: ["Next.js", "React", "Express", "Node.js", "Vue", "Nuxt"],
  Python: ["FastAPI", "Django", "Flask", "SQLAlchemy", "Pandas"],
  SQL: ["PostgreSQL", "MySQL", "SQLite"],
  Go: ["Gin", "Echo", "Fiber"],
  Rust: ["Axum", "Actix"],
  Java: ["Spring Boot"],
  "C#": ["ASP.NET Core"],
  PHP: ["Laravel"],
  Ruby: ["Rails"],
};

export const {
  PROMPT_MIN_LENGTH,
  PROMPT_MAX_LENGTH,
  MODEL_MIN_SELECT,
  MODEL_MAX_SELECT,
  OPENROUTER_TIMEOUT_MS,
  OPENROUTER_MAX_TOKENS,
  COMPARE_RATE_LIMIT_WINDOW_MS,
  COMPARE_RATE_LIMIT_MAX_REQUESTS,
  VOTE_RATE_LIMIT_WINDOW_MS,
  VOTE_RATE_LIMIT_MAX_REQUESTS,
  MODELS_RATE_LIMIT_WINDOW_MS,
  MODELS_RATE_LIMIT_MAX_REQUESTS,
  HISTORY_RATE_LIMIT_WINDOW_MS,
  HISTORY_RATE_LIMIT_MAX_REQUESTS,
  HISTORY_PAGE_SIZE_DEFAULT,
  HISTORY_PAGE_SIZE_MAX,
  CODE_COMPARE_RATE_LIMIT_WINDOW_MS,
  CODE_COMPARE_RATE_LIMIT_MAX_REQUESTS,
  CODE_PROMPT_MIN_LENGTH,
  CODE_PROMPT_MAX_LENGTH,
  CODE_MODEL_MIN_SELECT,
  CODE_MODEL_MAX_SELECT,
} = ARENA_CONSTANTS;
