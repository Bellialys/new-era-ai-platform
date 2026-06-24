CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_actor ON public.audit_log(actor_id);
CREATE INDEX idx_audit_log_created ON public.audit_log(created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.audit_log FROM anon, authenticated;
GRANT INSERT, SELECT ON public.audit_log TO service_role;

DROP POLICY IF EXISTS audit_log_service_role_select ON public.audit_log;
DROP POLICY IF EXISTS audit_log_service_role_insert ON public.audit_log;

CREATE POLICY audit_log_service_role_select
ON public.audit_log
FOR SELECT
TO service_role
USING (true);

CREATE POLICY audit_log_service_role_insert
ON public.audit_log
FOR INSERT
TO service_role
WITH CHECK (true);
