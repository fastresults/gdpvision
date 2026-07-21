
ALTER TABLE public.persona_projects
  ADD COLUMN IF NOT EXISTS brief_raw text,
  ADD COLUMN IF NOT EXISTS brief_scope jsonb,
  ADD COLUMN IF NOT EXISTS brief_uploads jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS brief_committed_at timestamptz;

-- Backfill: mark every existing program as committed so in-flight work is not blocked.
UPDATE public.persona_projects
   SET brief_committed_at = COALESCE(brief_committed_at, updated_at, created_at, now()),
       brief_raw = COALESCE(brief_raw, title)
 WHERE brief_committed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_persona_projects_brief_committed
  ON public.persona_projects (country_code, brief_committed_at);
