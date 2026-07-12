-- Onboarding runs: one row per agent invocation
CREATE TABLE public.onboarding_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code TEXT NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('profile','gdp','sector_composition','ministries','ministry_sector_map')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','planning','searching','extracting','validating','ready','committed','failed','cancelled')),
  started_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  model_stack JSONB NOT NULL DEFAULT '{}'::jsonb,
  plan JSONB,
  cost_cents INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX onboarding_runs_country_stage_idx ON public.onboarding_runs (country_code, stage, started_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_runs TO authenticated;
GRANT ALL ON public.onboarding_runs TO service_role;

ALTER TABLE public.onboarding_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage onboarding runs"
  ON public.onboarding_runs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER onboarding_runs_updated_at
  BEFORE UPDATE ON public.onboarding_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Onboarding drafts: proposed rows before commit
CREATE TABLE public.onboarding_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.onboarding_runs(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  target_table TEXT NOT NULL,
  payload JSONB NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high','medium','low')),
  needs_review BOOLEAN NOT NULL DEFAULT true,
  edited_payload JSONB,
  committed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX onboarding_drafts_run_idx ON public.onboarding_drafts (run_id);
CREATE INDEX onboarding_drafts_country_stage_idx ON public.onboarding_drafts (country_code, stage);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_drafts TO authenticated;
GRANT ALL ON public.onboarding_drafts TO service_role;

ALTER TABLE public.onboarding_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage onboarding drafts"
  ON public.onboarding_drafts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER onboarding_drafts_updated_at
  BEFORE UPDATE ON public.onboarding_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Onboarding citations: URLs cited by agents, attached to drafts
CREATE TABLE public.onboarding_citations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  draft_id UUID NOT NULL REFERENCES public.onboarding_drafts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  domain TEXT,
  title TEXT,
  quote TEXT,
  published_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX onboarding_citations_draft_idx ON public.onboarding_citations (draft_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_citations TO authenticated;
GRANT ALL ON public.onboarding_citations TO service_role;

ALTER TABLE public.onboarding_citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage onboarding citations"
  ON public.onboarding_citations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));