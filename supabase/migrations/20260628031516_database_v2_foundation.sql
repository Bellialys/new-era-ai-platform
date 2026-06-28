-- =============================================================================
-- Database v2 Foundation
-- Adds analytics, history, cache and audit tables.
-- All new tables: RLS enabled, service_role only (except leaderboard_snapshots
-- which also grants public read for the leaderboard page).
-- No existing tables are modified.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. usage_events — per-request AI analytics (tokens, cost, latency, errors)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.usage_events (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_id           text,
  mode_slug          text        NOT NULL,
  model_key          text        NOT NULL,
  prompt_tokens      integer,
  completion_tokens  integer,
  latency_ms         integer,
  cost_usd           numeric(12, 8),
  error_code         text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user_created   ON public.usage_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_mode_created   ON public.usage_events (mode_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_created        ON public.usage_events (created_at DESC);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.usage_events FROM anon, authenticated;
GRANT INSERT, SELECT ON public.usage_events TO service_role;

DROP POLICY IF EXISTS usage_events_service_role_select ON public.usage_events;
DROP POLICY IF EXISTS usage_events_service_role_insert ON public.usage_events;

CREATE POLICY usage_events_service_role_select
ON public.usage_events
FOR SELECT
TO service_role
USING (true);

CREATE POLICY usage_events_service_role_insert
ON public.usage_events
FOR INSERT
TO service_role
WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2. team_runs — top-level record per AI Team Mode execution
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.team_runs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          uuid        REFERENCES public.tasks(id) ON DELETE SET NULL,
  user_id          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  model_key        text        NOT NULL,
  status           text        NOT NULL DEFAULT 'completed'
                   CONSTRAINT team_runs_status_check CHECK (status IN ('completed', 'partial', 'failed')),
  final_answer     text,
  total_latency_ms integer,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_runs_user_created ON public.team_runs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_runs_task         ON public.team_runs (task_id);

ALTER TABLE public.team_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.team_runs FROM anon, authenticated;
GRANT INSERT, SELECT ON public.team_runs TO service_role;

DROP POLICY IF EXISTS team_runs_service_role_select ON public.team_runs;
DROP POLICY IF EXISTS team_runs_service_role_insert ON public.team_runs;

CREATE POLICY team_runs_service_role_select
ON public.team_runs
FOR SELECT
TO service_role
USING (true);

CREATE POLICY team_runs_service_role_insert
ON public.team_runs
FOR INSERT
TO service_role
WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3. team_run_steps — one row per role per team_run (planner/researcher/critic/finalizer)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.team_run_steps (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_run_id   uuid        NOT NULL REFERENCES public.team_runs(id) ON DELETE CASCADE,
  role_id       text        NOT NULL,
  role_label    text        NOT NULL,
  prompt        text        NOT NULL,
  response      text,
  latency_ms    integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_run_steps_team_run ON public.team_run_steps (team_run_id);

ALTER TABLE public.team_run_steps ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.team_run_steps FROM anon, authenticated;
GRANT INSERT, SELECT ON public.team_run_steps TO service_role;

DROP POLICY IF EXISTS team_run_steps_service_role_select ON public.team_run_steps;
DROP POLICY IF EXISTS team_run_steps_service_role_insert ON public.team_run_steps;

CREATE POLICY team_run_steps_service_role_select
ON public.team_run_steps
FOR SELECT
TO service_role
USING (true);

CREATE POLICY team_run_steps_service_role_insert
ON public.team_run_steps
FOR INSERT
TO service_role
WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4. code_runs — history of Code Runner executions via external Piston runner
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.code_runs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  language    text        NOT NULL,
  code        text        NOT NULL,
  stdin       text,
  stdout      text,
  stderr      text,
  exit_code   integer,
  runner_url  text        NOT NULL,
  latency_ms  integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_code_runs_user_created ON public.code_runs (user_id, created_at DESC);

ALTER TABLE public.code_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.code_runs FROM anon, authenticated;
GRANT INSERT, SELECT ON public.code_runs TO service_role;

DROP POLICY IF EXISTS code_runs_service_role_select ON public.code_runs;
DROP POLICY IF EXISTS code_runs_service_role_insert ON public.code_runs;

CREATE POLICY code_runs_service_role_select
ON public.code_runs
FOR SELECT
TO service_role
USING (true);

CREATE POLICY code_runs_service_role_insert
ON public.code_runs
FOR INSERT
TO service_role
WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 5. leaderboard_snapshots — materialised daily leaderboard cache
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date       date        NOT NULL,
  model_key           text        NOT NULL,
  model_display_name  text        NOT NULL,
  total_votes         integer     NOT NULL DEFAULT 0,
  wins                integer     NOT NULL DEFAULT 0,
  losses              integer     NOT NULL DEFAULT 0,
  ties                integer     NOT NULL DEFAULT 0,
  win_rate            numeric(6, 5) NOT NULL DEFAULT 0,
  elo_score           numeric(8, 2),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_date_rate  ON public.leaderboard_snapshots (snapshot_date DESC, win_rate DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_model_key  ON public.leaderboard_snapshots (model_key);

ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.leaderboard_snapshots FROM anon, authenticated;
GRANT INSERT, SELECT ON public.leaderboard_snapshots TO service_role;
GRANT SELECT ON public.leaderboard_snapshots TO anon, authenticated;

DROP POLICY IF EXISTS leaderboard_snapshots_service_role_select ON public.leaderboard_snapshots;
DROP POLICY IF EXISTS leaderboard_snapshots_service_role_insert ON public.leaderboard_snapshots;
DROP POLICY IF EXISTS leaderboard_snapshots_public_read         ON public.leaderboard_snapshots;

CREATE POLICY leaderboard_snapshots_service_role_select
ON public.leaderboard_snapshots
FOR SELECT
TO service_role
USING (true);

CREATE POLICY leaderboard_snapshots_service_role_insert
ON public.leaderboard_snapshots
FOR INSERT
TO service_role
WITH CHECK (true);

-- Snapshots are pre-aggregated, non-personal data — safe to expose publicly.
CREATE POLICY leaderboard_snapshots_public_read
ON public.leaderboard_snapshots
FOR SELECT
USING (true);

-- ---------------------------------------------------------------------------
-- 6. artifacts — file metadata for images and other outputs (no binary in PG)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.artifacts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  artifact_type text        NOT NULL
                CONSTRAINT artifacts_type_check CHECK (artifact_type IN ('image', 'document', 'code_output')),
  storage_path  text        NOT NULL,
  mime_type     text        NOT NULL,
  size_bytes    bigint,
  metadata      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  task_id       uuid        REFERENCES public.tasks(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artifacts_user_created ON public.artifacts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifacts_task         ON public.artifacts (task_id);

ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.artifacts FROM anon, authenticated;
GRANT INSERT, SELECT ON public.artifacts TO service_role;

DROP POLICY IF EXISTS artifacts_service_role_select ON public.artifacts;
DROP POLICY IF EXISTS artifacts_service_role_insert ON public.artifacts;

CREATE POLICY artifacts_service_role_select
ON public.artifacts
FOR SELECT
TO service_role
USING (true);

CREATE POLICY artifacts_service_role_insert
ON public.artifacts
FOR INSERT
TO service_role
WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 7. model_price_history — append-only history of OpenRouter model pricing
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.model_price_history (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  model_key                 text        NOT NULL,
  input_price_per_million   numeric(14, 6),
  output_price_per_million  numeric(14, 6),
  effective_from            timestamptz NOT NULL,
  effective_to              timestamptz,
  source                    text        NOT NULL,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_price_history_model_key   ON public.model_price_history (model_key);
CREATE INDEX IF NOT EXISTS idx_model_price_history_effective   ON public.model_price_history (effective_from DESC);

ALTER TABLE public.model_price_history ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.model_price_history FROM anon, authenticated;
GRANT INSERT, SELECT ON public.model_price_history TO service_role;

DROP POLICY IF EXISTS model_price_history_service_role_select ON public.model_price_history;
DROP POLICY IF EXISTS model_price_history_service_role_insert ON public.model_price_history;

CREATE POLICY model_price_history_service_role_select
ON public.model_price_history
FOR SELECT
TO service_role
USING (true);

CREATE POLICY model_price_history_service_role_insert
ON public.model_price_history
FOR INSERT
TO service_role
WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 8. cleanup_log — audit trail for automated data retention jobs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cleanup_log (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cleanup_type       text        NOT NULL,
  rows_deleted       integer     NOT NULL DEFAULT 0,
  oldest_deleted_at  timestamptz,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cleanup_log_created ON public.cleanup_log (created_at DESC);

ALTER TABLE public.cleanup_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.cleanup_log FROM anon, authenticated;
GRANT INSERT, SELECT ON public.cleanup_log TO service_role;

DROP POLICY IF EXISTS cleanup_log_service_role_select ON public.cleanup_log;
DROP POLICY IF EXISTS cleanup_log_service_role_insert ON public.cleanup_log;

CREATE POLICY cleanup_log_service_role_select
ON public.cleanup_log
FOR SELECT
TO service_role
USING (true);

CREATE POLICY cleanup_log_service_role_insert
ON public.cleanup_log
FOR INSERT
TO service_role
WITH CHECK (true);
