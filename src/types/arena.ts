export type ArenaModel = {
  id: string;
  name: string;
  provider: "openrouter";
  role: string;
  badge?: string;
  description?: string;
};

export type ArenaResponseStatus = "success" | "error";

export type ArenaApiResponse = {
  id: string;
  modelId: string;
  modelName: string;
  status: ArenaResponseStatus;
  answerText: string | null;
  latencyMs?: number;
  errorCode?: string;
  errorMessage?: string;
};

export type ArenaResponseView = ArenaApiResponse & {
  modelRole: string;
  isStreaming?: boolean;
};

export type JudgeVerdict = {
  /** modelId (selectionId) of the winning response */
  winnerModelId: string;
  /** Display name of the winning model */
  winnerModelName: string;
  /** Blind label of the winner: "A", "B", "C", etc. */
  winnerLabel: string;
  /** Judge's reasoning for picking the winner (2-4 sentences) */
  reasoning: string;
  /** Scores per modelId (1-10), optional */
  scores: Record<string, number>;
};
