
ALTER TABLE public.comms_artifacts
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_reviewers uuid[] DEFAULT '{}'::uuid[];

CREATE INDEX IF NOT EXISTS idx_comms_artifacts_scope_state_updated
  ON public.comms_artifacts (scope_key, draft_state, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_comms_artifacts_scope_scheduled
  ON public.comms_artifacts (scope_key, scheduled_for)
  WHERE deleted_at IS NULL AND scheduled_for IS NOT NULL;
