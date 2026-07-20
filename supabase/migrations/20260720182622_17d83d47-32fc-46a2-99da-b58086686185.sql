
ALTER TABLE public.persona_study_drafts
  ADD COLUMN IF NOT EXISTS phase_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text;

CREATE INDEX IF NOT EXISTS persona_study_drafts_locked_at_idx
  ON public.persona_study_drafts (locked_at)
  WHERE locked_at IS NOT NULL;
