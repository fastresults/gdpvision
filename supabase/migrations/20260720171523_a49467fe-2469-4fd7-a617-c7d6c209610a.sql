ALTER TABLE public.persona_study_drafts
  ADD COLUMN IF NOT EXISTS autorun_status jsonb,
  ADD COLUMN IF NOT EXISTS study_id uuid;