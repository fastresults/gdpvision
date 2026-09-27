ALTER TABLE public.kpis
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS ai_rationale text,
  ADD COLUMN IF NOT EXISTS peer_median numeric,
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS source_kpi_code text,
  ADD COLUMN IF NOT EXISTS inferred boolean NOT NULL DEFAULT false;

ALTER TABLE public.kpis ADD CONSTRAINT kpis_source_check CHECK (source IN ('manual','ai')) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS kpis_ministry_metric_uniq
  ON public.kpis (country_code, ministry_id, lower(btrim(metric)))
  WHERE ministry_id IS NOT NULL;

CREATE TABLE public.kpi_setup_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  ministry_id uuid NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  step integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'in_progress',
  draft jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kpi_setup_sessions_status_check CHECK (status IN ('in_progress','ai_drafted','submitted')),
  UNIQUE (country_code, ministry_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpi_setup_sessions TO authenticated;
GRANT ALL ON public.kpi_setup_sessions TO service_role;

ALTER TABLE public.kpi_setup_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi setup read" ON public.kpi_setup_sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_country_access(auth.uid(), country_code));

CREATE POLICY "kpi setup write" ON public.kpi_setup_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cabinet_secretary'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'cabinet_secretary'));

CREATE TRIGGER kpi_setup_sessions_updated BEFORE UPDATE ON public.kpi_setup_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();