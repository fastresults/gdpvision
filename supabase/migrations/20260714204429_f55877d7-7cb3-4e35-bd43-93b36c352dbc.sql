
CREATE TABLE IF NOT EXISTS public.corpus_fetch_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code TEXT NOT NULL,
  domain TEXT NOT NULL,
  key TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('hit','external','empty','throttled','error')),
  tier TEXT,
  credits NUMERIC,
  latency_ms INTEGER,
  actor UUID,
  notes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS corpus_fetch_attempts_lookup_idx
  ON public.corpus_fetch_attempts (country_code, domain, key, created_at DESC);
CREATE INDEX IF NOT EXISTS corpus_fetch_attempts_recent_idx
  ON public.corpus_fetch_attempts (created_at DESC);

GRANT SELECT ON public.corpus_fetch_attempts TO authenticated;
GRANT ALL ON public.corpus_fetch_attempts TO service_role;
ALTER TABLE public.corpus_fetch_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view corpus fetch attempts"
  ON public.corpus_fetch_attempts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE UNIQUE INDEX IF NOT EXISTS onboarding_citations_draft_url_uidx
  ON public.onboarding_citations (draft_id, url);
