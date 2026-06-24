-- v1.3 Judge Mode: store AI judge verdict per comparison task
-- Already applied via Supabase MCP — this file is for version tracking only
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS judge_verdict jsonb;

COMMENT ON COLUMN tasks.judge_verdict IS 'AI judge verdict (v1.3): { winnerModelId, winnerModelName, winnerLabel, reasoning, scores: {modelId: score} }. Populated by POST /api/judge. Null when no judge evaluation has been requested.';
