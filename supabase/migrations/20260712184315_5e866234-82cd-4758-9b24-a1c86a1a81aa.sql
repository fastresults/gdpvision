
-- Add inference fields to country_kpis
ALTER TABLE public.country_kpis
  ADD COLUMN IF NOT EXISTS provenance TEXT NOT NULL DEFAULT 'verified',
  ADD COLUMN IF NOT EXISTS confidence TEXT,
  ADD COLUMN IF NOT EXISTS inference_rationale TEXT,
  ADD COLUMN IF NOT EXISTS inference_evidence JSONB,
  ADD COLUMN IF NOT EXISTS inference_model TEXT,
  ADD COLUMN IF NOT EXISTS inferred_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by UUID,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_note TEXT,
  ADD COLUMN IF NOT EXISTS inference_history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Source candidates: URLs suggested by inference model that admin can approve
CREATE TABLE IF NOT EXISTS public.source_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code TEXT NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  suggested_by_model TEXT,
  suggested_for_kpi TEXT,
  rationale TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_code, url)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_candidates TO authenticated;
GRANT ALL ON public.source_candidates TO service_role;

ALTER TABLE public.source_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "source_candidates admin read"
  ON public.source_candidates FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "source_candidates admin write"
  ON public.source_candidates
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER source_candidates_updated
  BEFORE UPDATE ON public.source_candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
