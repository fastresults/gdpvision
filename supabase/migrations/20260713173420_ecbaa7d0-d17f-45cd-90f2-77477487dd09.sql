CREATE TABLE public.onboarding_pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('pending', 'rerun', 'single-stage')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  current_stage text,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  results jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  started_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_pipeline_runs TO authenticated;
GRANT ALL ON public.onboarding_pipeline_runs TO service_role;

ALTER TABLE public.onboarding_pipeline_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage onboarding pipeline runs"
ON public.onboarding_pipeline_runs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX onboarding_pipeline_runs_country_started_idx
ON public.onboarding_pipeline_runs (country_code, started_at DESC);

CREATE UNIQUE INDEX onboarding_pipeline_runs_one_running_per_country
ON public.onboarding_pipeline_runs (country_code)
WHERE status = 'running';

CREATE TRIGGER onboarding_pipeline_runs_updated
BEFORE UPDATE ON public.onboarding_pipeline_runs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();