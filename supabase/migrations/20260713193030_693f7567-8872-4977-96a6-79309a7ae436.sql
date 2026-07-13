CREATE TABLE IF NOT EXISTS public.capital_flow_research_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  run_id uuid REFERENCES public.onboarding_runs(id) ON DELETE CASCADE,
  node_key text NOT NULL,
  pass text NOT NULL,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  value_usd_m numeric,
  period text,
  method text,
  confidence_grade text,
  source_url text,
  source_org text,
  source_kind text,
  formula text,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.capital_flow_research_attempts TO authenticated;
GRANT ALL ON public.capital_flow_research_attempts TO service_role;

ALTER TABLE public.capital_flow_research_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage capital flow research attempts"
ON public.capital_flow_research_attempts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS capital_flow_attempts_country_run_idx
ON public.capital_flow_research_attempts(country_code, run_id, node_key, created_at DESC);

CREATE INDEX IF NOT EXISTS capital_flow_attempts_node_idx
ON public.capital_flow_research_attempts(country_code, node_key, created_at DESC);