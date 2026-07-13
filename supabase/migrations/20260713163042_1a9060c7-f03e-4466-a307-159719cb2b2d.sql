
CREATE TABLE public.country_authorized_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  domain text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('official','learned','reference','press')),
  first_seen_stage text,
  citation_count int NOT NULL DEFAULT 1,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  demoted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, domain)
);

GRANT SELECT ON public.country_authorized_domains TO authenticated;
GRANT ALL ON public.country_authorized_domains TO service_role;

ALTER TABLE public.country_authorized_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read authorized domains"
  ON public.country_authorized_domains FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage authorized domains"
  ON public.country_authorized_domains FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX country_authorized_domains_country_idx
  ON public.country_authorized_domains (country_code)
  WHERE demoted_at IS NULL;

ALTER TABLE public.onboarding_citations
  ADD COLUMN IF NOT EXISTS domain_tier text,
  ADD COLUMN IF NOT EXISTS promoted_domain boolean NOT NULL DEFAULT false;
