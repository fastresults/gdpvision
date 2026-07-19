
-- 1) Extend narrative_feeds
ALTER TABLE public.narrative_feeds
  ADD COLUMN IF NOT EXISTS last_revive_at timestamptz;

-- 2) Watchlist table
CREATE TABLE IF NOT EXISTS public.narrative_entity_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  entity_name text NOT NULL,
  entity_role text,
  source text NOT NULL DEFAULT 'manual',
  active boolean NOT NULL DEFAULT true,
  last_feed_built_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, entity_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.narrative_entity_watchlist TO authenticated;
GRANT ALL ON public.narrative_entity_watchlist TO service_role;

ALTER TABLE public.narrative_entity_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watchlist read by country members"
  ON public.narrative_entity_watchlist FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_country_access(auth.uid(), country_code)
  );

CREATE POLICY "watchlist write by country admins"
  ON public.narrative_entity_watchlist FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_country_role(auth.uid(), 'country_admin'::public.app_role, country_code)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_country_role(auth.uid(), 'country_admin'::public.app_role, country_code)
  );

CREATE INDEX IF NOT EXISTS idx_watchlist_country_active
  ON public.narrative_entity_watchlist (country_code, active);

-- 3) Seed reputational + governance + wires query feeds per active country
WITH targets AS (
  SELECT c.code, c.name,
         replace(c.name, ' ', '+') AS name_plus,
         '%22' || replace(c.name, ' ', '+') || '%22' AS name_quoted_plus
  FROM public.countries c
  WHERE c.code IN ('AIA','ATG','BHS','BLZ','BMU','BRB','CYM','DMA','GLP','GRD','GUY','HTI','JAM','KNA','LCA','MSR','MTQ','SUR','TCA','TTO','VCT','VGB')
),
seeds AS (
  -- Reputational / integrity lane
  SELECT code AS country_code,
    'international'::text AS scope,
    'google_news'::text AS kind,
    'https://news.google.com/rss/search?q=' || name_plus ||
      '+(lawsuit+OR+judgment+OR+judgement+OR+sanction+OR+OFAC+OR+indictment+OR+corruption+OR+bribery+OR+%22money+laundering%22+OR+envoy+OR+ambassador+OR+passport+OR+%22citizenship+by+investment%22+OR+CBI)&hl=en-US&gl=US&ceid=US:en'
      AS endpoint,
    name || ' · Reputational & integrity (Google News)' AS label,
    'reputational'::text AS tier_hint
  FROM targets
  UNION ALL
  -- Governance lane
  SELECT code,
    'local'::text,
    'google_news'::text,
    'https://news.google.com/rss/search?q=' || name_plus ||
      '+(cabinet+OR+%22prime+minister%22+OR+parliament+OR+budget+OR+%22auditor+general%22+OR+procurement+OR+contract+OR+scandal+OR+resign+OR+opposition)&hl=en-US&gl=US&ceid=US:en',
    name || ' · Governance & accountability (Google News)',
    'governance'::text
  FROM targets
  UNION ALL
  -- International wires lane (GDELT themes)
  SELECT code,
    'international'::text,
    'gdelt'::text,
    'https://api.gdeltproject.org/api/v2/doc/doc?query=' || name_quoted_plus ||
      '+(theme:CORRUPTION+OR+theme:LEGISLATION+OR+theme:TRIAL+OR+theme:SANCTIONS+OR+theme:TAX_HAVENS+OR+theme:LEGAL)&mode=ArtList&format=json&timespan=48h&maxrecords=50',
    name || ' · Global wires (GDELT themes)',
    'reputational'::text
  FROM targets
)
INSERT INTO public.narrative_feeds
  (country_code, scope, kind, endpoint, label, is_seed, is_query, tier_hint, active)
SELECT country_code, scope, kind, endpoint, label, false, true, tier_hint, true
FROM seeds
ON CONFLICT (country_code, endpoint) DO UPDATE
  SET label = EXCLUDED.label,
      tier_hint = EXCLUDED.tier_hint,
      is_query = true,
      active = true,
      consecutive_failures = 0;

-- 4) updated_at trigger for watchlist
DROP TRIGGER IF EXISTS trg_watchlist_updated_at ON public.narrative_entity_watchlist;
CREATE TRIGGER trg_watchlist_updated_at
  BEFORE UPDATE ON public.narrative_entity_watchlist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
