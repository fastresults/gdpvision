
CREATE TABLE public.onboarding_summaries (
  country_code text NOT NULL,
  stage text NOT NULL,
  summary_md text NOT NULL DEFAULT '',
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  source_run_id uuid,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (country_code, stage)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_summaries TO authenticated;
GRANT ALL ON public.onboarding_summaries TO service_role;

ALTER TABLE public.onboarding_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read onboarding summaries"
  ON public.onboarding_summaries FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can write onboarding summaries"
  ON public.onboarding_summaries FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER onboarding_summaries_updated_at
  BEFORE UPDATE ON public.onboarding_summaries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
