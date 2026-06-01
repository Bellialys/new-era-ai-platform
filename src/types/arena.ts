export type ArenaModel = {
  id: string;
  name: string;
  provider: string;
  role: string;
  description: string;
  badge: string;
};

export type ArenaResponseStatus = "success" | "error";

export type ArenaResponse = {
  id: string;
  modelId: string;
  modelName: string;
  modelRole: string;
  status: ArenaResponseStatus;
  text: string;
  latencyMs: number;
};
