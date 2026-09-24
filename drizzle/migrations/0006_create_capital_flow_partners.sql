CREATE TABLE public.country_capital_flow_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  node_key text NOT NULL,
  period text NOT NULL,
  partner_name text NOT NULL,
  partner_iso3 text,
  partner_lat double precision,
  partner_lon double precision,
  share_pct numeric,
  value_usd_m numeric,
  confidence_grade text NOT NULL DEFAULT 'C',
  visibility text NOT NULL DEFAULT 'public',
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT country_capital_flow_partners_dedup UNIQUE (country_code, node_key, period, partner_name)
);

GRANT SELECT ON public.country_capital_flow_partners TO authenticated;
GRANT ALL ON public.country_capital_flow_partners TO service_role;

ALTER TABLE public.country_capital_flow_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Country users read partner flows they can access"
ON public.country_capital_flow_partners
FOR SELECT
TO authenticated
USING (public.has_country_access(auth.uid(), country_code));

CREATE INDEX country_capital_flow_partners_lookup
ON public.country_capital_flow_partners (country_code, node_key, period);