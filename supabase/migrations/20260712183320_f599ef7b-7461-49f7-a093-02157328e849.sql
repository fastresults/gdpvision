
-- 1. Extend country_kpis with freshness metadata
ALTER TABLE public.country_kpis
  ADD COLUMN IF NOT EXISTS freshness_status text NOT NULL DEFAULT 'missing',
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS research_notes text;

-- 2. Track every research attempt
CREATE TABLE IF NOT EXISTS public.kpi_research_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.onboarding_runs(id) ON DELETE SET NULL,
  country_code text NOT NULL,
  kpi_code text NOT NULL,
  pass text NOT NULL, -- 'sweep' | 'worldbank' | 'imf' | 'targeted' | 'escalation'
  provider text NOT NULL, -- 'perplexity' | 'worldbank' | 'imf' | 'lovable-ai'
  model text,
  ok boolean NOT NULL DEFAULT false,
  value numeric,
  period text,
  source_url text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.kpi_research_attempts TO authenticated;
GRANT ALL ON public.kpi_research_attempts TO service_role;

ALTER TABLE public.kpi_research_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpi_research_attempts read admin"
  ON public.kpi_research_attempts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "kpi_research_attempts write admin"
  ON public.kpi_research_attempts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS kpi_research_attempts_country_kpi_idx
  ON public.kpi_research_attempts(country_code, kpi_code, created_at DESC);
