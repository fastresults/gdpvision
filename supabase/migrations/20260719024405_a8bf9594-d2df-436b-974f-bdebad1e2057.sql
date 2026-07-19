
-- 1) narrative_feeds: track last revive probe
ALTER TABLE public.narrative_feeds
  ADD COLUMN IF NOT EXISTS last_revive_at timestamptz;

-- 2) entity watchlist
CREATE TABLE IF NOT EXISTS public.narrative_entity_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  entity_name text NOT NULL,
  entity_role text,
  source text NOT NULL DEFAULT 'manual',
  active boolean NOT NULL DEFAULT true,
  last_feed_built_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, entity_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.narrative_entity_watchlist TO authenticated;
GRANT ALL ON public.narrative_entity_watchlist TO service_role;

ALTER TABLE public.narrative_entity_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watchlist_admin_all"
  ON public.narrative_entity_watchlist FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "watchlist_country_read"
  ON public.narrative_entity_watchlist FOR SELECT
  TO authenticated
  USING (public.has_country_access(auth.uid(), country_code));

CREATE POLICY "watchlist_country_write"
  ON public.narrative_entity_watchlist FOR ALL
  TO authenticated
  USING (public.has_country_role(auth.uid(), 'country_admin'::public.app_role, country_code))
  WITH CHECK (public.has_country_role(auth.uid(), 'country_admin'::public.app_role, country_code));

CREATE INDEX IF NOT EXISTS idx_watchlist_country_active
  ON public.narrative_entity_watchlist (country_code, active);

DROP TRIGGER IF EXISTS trg_watchlist_updated ON public.narrative_entity_watchlist;
CREATE TRIGGER trg_watchlist_updated
  BEFORE UPDATE ON public.narrative_entity_watchlist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Seed reputational + governance + wires query feeds for every active country
--    Uses Google News RSS (kind: google_news). Idempotent via unique key.
DO $$
DECLARE
  c RECORD;
  base_url text;
BEGIN
  -- ensure a country/endpoint unique constraint exists for upsert semantics
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='narrative_feeds_country_endpoint_key'
  ) THEN
    CREATE UNIQUE INDEX narrative_feeds_country_endpoint_key
      ON public.narrative_feeds (country_code, endpoint);
  END IF;

  FOR c IN SELECT code, name FROM public.countries LOOP
    -- Reputational lane
    base_url := 'https://news.google.com/rss/search?q=' ||
      replace(replace(
        '"' || c.name || '" (lawsuit OR judgment OR sanctions OR indictment OR envoy OR "money laundering" OR fraud OR probe)',
        ' ', '+'), '"', '%22') ||
      '&hl=en-US&gl=US&ceid=US:en';
    INSERT INTO public.narrative_feeds
      (country_code, scope, kind, endpoint, label, is_seed, is_query, tier_hint, discovered_at, active)
    VALUES
      (c.code, 'international', 'google_news', base_url,
       c.name || ' · Reputational risk (Google News)', false, true, 'reputational', now(), true)
    ON CONFLICT (country_code, endpoint) DO NOTHING;

    -- Governance lane
    base_url := 'https://news.google.com/rss/search?q=' ||
      replace(replace(
        '"' || c.name || '" (corruption OR integrity OR "prime minister" OR cabinet OR minister OR parliament OR tender OR procurement)',
        ' ', '+'), '"', '%22') ||
      '&hl=en-US&gl=US&ceid=US:en';
    INSERT INTO public.narrative_feeds
      (country_code, scope, kind, endpoint, label, is_seed, is_query, tier_hint, discovered_at, active)
    VALUES
      (c.code, 'international', 'google_news', base_url,
       c.name || ' · Governance & integrity (Google News)', false, true, 'governance', now(), true)
    ON CONFLICT (country_code, endpoint) DO NOTHING;

    -- Global wires lane
    base_url := 'https://news.google.com/rss/search?q=' ||
      replace(replace(
        '"' || c.name || '" (site:reuters.com OR site:apnews.com OR site:bloomberg.com OR site:ft.com OR site:wsj.com OR site:bbc.com)',
        ' ', '+'), '"', '%22') ||
      '&hl=en-US&gl=US&ceid=US:en';
    INSERT INTO public.narrative_feeds
      (country_code, scope, kind, endpoint, label, is_seed, is_query, tier_hint, discovered_at, active)
    VALUES
      (c.code, 'international', 'google_news', base_url,
       c.name || ' · Global wires (Google News)', false, true, 'international', now(), true)
    ON CONFLICT (country_code, endpoint) DO NOTHING;
  END LOOP;
END $$;
