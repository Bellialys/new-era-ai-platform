export type ArenaModel = {
  id: string;
  name: string;
  provider: string;
  role: string;
};

export type ArenaResponseStatus = "success" | "error";

export type ArenaApiResponse = {
  modelId: string;
  answerText: string;
  latencyMs?: number;
  errorCode?: string;
};

export type ArenaResponseView = ArenaApiResponse & {
  modelRole: string;
};
