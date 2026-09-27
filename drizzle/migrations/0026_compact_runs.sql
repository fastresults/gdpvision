CREATE TABLE public.compact_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compact_id uuid NOT NULL REFERENCES public.mandate_compacts(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  step text NOT NULL CHECK (step IN ('decompose','transform')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('queued','running','succeeded','failed','stalled')),
  stage text,
  stage_detail text,
  started_at timestamptz NOT NULL DEFAULT now(),
  heartbeat_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  error text,
  result jsonb,
  created_by uuid DEFAULT auth.uid()
);
CREATE INDEX compact_runs_compact_idx ON public.compact_runs (compact_id, started_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.compact_runs TO authenticated;
GRANT ALL ON public.compact_runs TO service_role;
ALTER TABLE public.compact_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Country members read compact runs" ON public.compact_runs FOR SELECT TO authenticated
  USING (public.has_country_access(auth.uid(), country_code));
CREATE POLICY "Country members start compact runs" ON public.compact_runs FOR INSERT TO authenticated
  WITH CHECK (public.has_country_access(auth.uid(), country_code) AND created_by = auth.uid());
CREATE POLICY "Run owners or admins update compact runs" ON public.compact_runs FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));