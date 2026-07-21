ALTER TABLE public.persona_segments
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.persona_projects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS persona_segments_project_idx
  ON public.persona_segments(project_id);

CREATE INDEX IF NOT EXISTS persona_segments_country_project_idx
  ON public.persona_segments(country_code, project_id);