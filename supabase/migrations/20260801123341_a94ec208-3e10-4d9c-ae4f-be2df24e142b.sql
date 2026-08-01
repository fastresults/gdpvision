CREATE TABLE IF NOT EXISTS public.programme_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.persona_projects(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','shared')),
  document jsonb NOT NULL DEFAULT '{}'::jsonb,
  cover jsonb NOT NULL DEFAULT '{}'::jsonb,
  assembled_by uuid,
  assembled_at timestamptz NOT NULL DEFAULT now(),
  shared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version)
);

CREATE INDEX IF NOT EXISTS programme_briefings_project_idx
  ON public.programme_briefings (project_id, version DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.programme_briefings TO authenticated;
GRANT ALL ON public.programme_briefings TO service_role;

ALTER TABLE public.programme_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "programme_briefings read" ON public.programme_briefings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));

CREATE POLICY "programme_briefings write" ON public.programme_briefings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));

CREATE TRIGGER programme_briefings_updated_at BEFORE UPDATE ON public.programme_briefings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();