/**
 * Client-facing history types. These mirror the JSON returned by
 * /api/history and /api/history/[taskId]. They are intentionally separate from
 * the server-side types in src/lib/server/history.ts so that client components
 * never import server-only modules.
 */

import type { JudgeVerdict } from "@/types/arena";

export type HistoryListItemView = {
  taskId: string;
  modeSlug: string;
  taskText: string;
  status: string;
  selectedModels: string[];
  modelCount: number;
  createdAt: string;
  hasWinner: boolean;
};

export type HistoryResponseView = {
  responseId: string;
  modelKey: string | null;
  displayName: string | null;
  status: string;
  responseText: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  latencyMs: number | null;
  isWinner: boolean;
};

export type HistoryTaskView = {
  taskId: string;
  modeSlug: string;
  taskText: string;
  status: string;
  selectedModels: string[];
  settings: Record<string, unknown>;
  createdAt: string;
  errorMessage: string | null;
  winnerResponseId: string | null;
  judgeVerdict: JudgeVerdict | null;
};

export type HistoryListApiResponse = {
  status: "success";
  items: HistoryListItemView[];
  nextCursor: string | null;
  requestId: string;
};

export type HistoryDetailApiResponse = {
  status: "success";
  task: HistoryTaskView;
  responses: HistoryResponseView[];
  requestId: string;
};
