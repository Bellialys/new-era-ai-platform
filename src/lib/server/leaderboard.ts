/**
 * Server-side leaderboard aggregation.
 *
 * Reads from three tables (model_responses, votes, models) and aggregates
 * win counts in application memory. Degrades gracefully: any query failure
 * or missing Supabase config returns an empty list rather than throwing, so
 * the leaderboard page renders an empty state instead of a 500.
 */

import { getSupabaseServerClient } from "./supabase";
import { badgeFromTags } from "./model-catalog";

export type LeaderboardEntry = {
  modelId: string;
  modelName: string;
  badge: string[];
  wins: number;
  totalBattles: number;
  winRate: number;
  rank: number;
};

type ModelRow = {
  id: string;
  display_name: string;
  role_tags: string[] | null;
  price_label: string | null;
};

type ResponseRow = {
  id: string;
  model_id: string | null;
};

type VoteRow = {
  model_response_id: string;
};

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return [];
  }

  // Step 1: map every model_response id → model_id and count battles per model
  const { data: responsesData, error: responsesError } = await supabase
    .from("model_responses")
    .select("id, model_id");

  if (responsesError) {
    console.error("getLeaderboard responses query failed:", responsesError);
    return [];
  }

  const responses = (responsesData ?? []) as ResponseRow[];

  const responseToModel = new Map<string, string>();
  const battlesByModel = new Map<string, number>();
  for (const row of responses) {
    if (!row.model_id) continue;
    responseToModel.set(row.id, row.model_id);
    battlesByModel.set(row.model_id, (battlesByModel.get(row.model_id) ?? 0) + 1);
  }

  if (battlesByModel.size === 0) {
    return [];
  }

  // Step 2: count 'best' wins per model via vote → model_response → model_id
  const { data: votesData, error: votesError } = await supabase
    .from("votes")
    .select("model_response_id")
    .eq("vote_type", "best");

  if (votesError) {
    console.error("getLeaderboard votes query failed:", votesError);
    return [];
  }

  const winsByModel = new Map<string, number>();
  for (const vote of (votesData ?? []) as VoteRow[]) {
    const modelId = responseToModel.get(vote.model_response_id);
    if (modelId) {
      winsByModel.set(modelId, (winsByModel.get(modelId) ?? 0) + 1);
    }
  }

  // Step 3: fetch display info for all models that have at least one battle
  const modelIds = [...battlesByModel.keys()];
  const { data: modelsData, error: modelsError } = await supabase
    .from("models")
    .select("id, display_name, role_tags, price_label")
    .in("id", modelIds);

  if (modelsError) {
    console.error("getLeaderboard models query failed:", modelsError);
    return [];
  }

  const entries: LeaderboardEntry[] = ((modelsData ?? []) as ModelRow[])
    .map((m) => {
      const totalBattles = battlesByModel.get(m.id) ?? 0;
      const wins = winsByModel.get(m.id) ?? 0;
      const badge = badgeFromTags(m.role_tags, m.price_label);
      return {
        modelId: m.id,
        modelName: m.display_name,
        badge: badge ? [badge] : [],
        wins,
        totalBattles,
        winRate: totalBattles > 0 ? wins / totalBattles : 0,
        rank: 0,
      };
    })
    .filter((e) => e.totalBattles > 0)
    .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins);

  entries.forEach((e, i) => {
    e.rank = i + 1;
  });

  return entries;
}
