/** Validation and public DTO mapping for owner-scoped saved prompt drafts. */
import { ApiError, isJsonObject } from "./utils";

export const SAVED_PROMPT_TITLE_LIMIT = 80;
export const SAVED_PROMPT_TEXT_LIMIT = 8000;
export const SAVED_PROMPT_LIST_LIMIT = 50;

export type SavedPromptRow = {
  id: string;
  title: string;
  prompt_text: string;
  created_at: string;
  updated_at: string;
};

export type SavedPromptDto = {
  id: string;
  title: string;
  promptText: string;
  createdAt: string;
  updatedAt: string;
};

export type SavedPromptChanges = {
  title?: string;
  prompt_text?: string;
};

/** Only expose the five explicit user-facing columns, never database ownership fields. */
export function toSavedPromptDto(row: SavedPromptRow): SavedPromptDto {
  return {
    id: row.id,
    title: row.title,
    promptText: row.prompt_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Validate all input, reject extra fields, and trim before persistence. */
export function parseSavedPromptInput(
  value: unknown,
  mode: "create" | "update"
): SavedPromptChanges {
  if (!isJsonObject(value)) {
    throw new ApiError(400, "INVALID_BODY", "Body must be a JSON object.");
  }

  for (const key of Object.keys(value)) {
    if (key !== "title" && key !== "promptText") {
      throw new ApiError(400, "VALIDATION_ERROR", "Unknown saved prompt field.");
    }
  }

  const result: SavedPromptChanges = {};
  if ("title" in value) {
    if (typeof value.title !== "string") {
      throw new ApiError(400, "VALIDATION_ERROR", "Title must be a string.");
    }
    const title = value.title.trim();
    if (title.length < 1 || title.length > SAVED_PROMPT_TITLE_LIMIT) {
      throw new ApiError(400, "VALIDATION_ERROR", "Title must contain 1–80 characters.");
    }
    result.title = title;
  }

  if ("promptText" in value) {
    if (typeof value.promptText !== "string") {
      throw new ApiError(400, "VALIDATION_ERROR", "Prompt must be a string.");
    }
    const promptText = value.promptText.trim();
    if (promptText.length < 3 || promptText.length > SAVED_PROMPT_TEXT_LIMIT) {
      throw new ApiError(400, "VALIDATION_ERROR", "Prompt must contain 3–8000 characters.");
    }
    result.prompt_text = promptText;
  }

  if (mode === "create" && (result.title === undefined || result.prompt_text === undefined)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Title and promptText are required.");
  }
  if (Object.keys(result).length === 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "No fields to update.");
  }
  return result;
}
