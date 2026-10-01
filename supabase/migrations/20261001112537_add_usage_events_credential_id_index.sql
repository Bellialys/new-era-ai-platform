-- Add a covering index for the usage_events.credential_id foreign key.
CREATE INDEX IF NOT EXISTS idx_usage_events_credential_id
  ON public.usage_events USING btree (credential_id);
