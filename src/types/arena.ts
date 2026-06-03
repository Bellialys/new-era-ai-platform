export type ArenaModel = {
  id: string;
  name: string;
  provider: string;
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
};
