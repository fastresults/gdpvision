ALTER TABLE public.persona_projects
  ADD COLUMN IF NOT EXISTS blueprint_proposal jsonb,
  ADD COLUMN IF NOT EXISTS blueprint_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS blueprint_committed_at timestamptz;

CREATE INDEX IF NOT EXISTS persona_projects_blueprint_committed_idx
  ON public.persona_projects (country_code, blueprint_committed_at);