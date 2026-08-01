CREATE TABLE IF NOT EXISTS public.programme_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.persona_projects(id) ON DELETE CASCADE,
  briefing_id uuid REFERENCES public.programme_briefings(id) ON DELETE SET NULL,
  country_code text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','shared')),
  deck jsonb NOT NULL DEFAULT '{}'::jsonb,
  assembled_by uuid,
  assembled_at timestamptz NOT NULL DEFAULT now(),
  shared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version)
);

CREATE INDEX IF NOT EXISTS programme_decks_project_idx
  ON public.programme_decks (project_id, version DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.programme_decks TO authenticated;
GRANT ALL ON public.programme_decks TO service_role;

ALTER TABLE public.programme_decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "programme_decks read" ON public.programme_decks
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));

CREATE POLICY "programme_decks write" ON public.programme_decks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));

CREATE TRIGGER programme_decks_updated_at BEFORE UPDATE ON public.programme_decks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();