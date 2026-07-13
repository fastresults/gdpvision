ALTER TABLE public.onboarding_drafts
  ADD COLUMN IF NOT EXISTS summary_md text NULL,
  ADD COLUMN IF NOT EXISTS summary_highlights jsonb NOT NULL DEFAULT '[]'::jsonb;