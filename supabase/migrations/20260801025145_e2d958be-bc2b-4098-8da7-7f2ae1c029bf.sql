CREATE TABLE public.research_recruitment_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.persona_projects(id) ON DELETE CASCADE,
  persona_label text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  pass integer NOT NULL DEFAULT 0,
  want integer NOT NULL DEFAULT 12,
  found integer NOT NULL DEFAULT 0,
  proposed integer NOT NULL DEFAULT 0,
  registries jsonb NOT NULL DEFAULT '[]'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_recruitment_runs TO authenticated;
GRANT ALL ON public.research_recruitment_runs TO service_role;

ALTER TABLE public.research_recruitment_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Country access manages recruitment runs"
  ON public.research_recruitment_runs FOR ALL
  TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE INDEX research_recruitment_runs_lookup
  ON public.research_recruitment_runs (project_id, persona_label, created_at DESC);

CREATE TRIGGER research_recruitment_runs_updated_at
  BEFORE UPDATE ON public.research_recruitment_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();