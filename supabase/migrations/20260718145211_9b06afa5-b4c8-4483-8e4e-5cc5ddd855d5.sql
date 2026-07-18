
-- 1) Extend narrative_feeds
ALTER TABLE public.narrative_feeds
  ADD COLUMN IF NOT EXISTS is_seed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_query boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discovered_at timestamptz,
  ADD COLUMN IF NOT EXISTS query_template text,
  ADD COLUMN IF NOT EXISTS tier_hint text;

-- 2) Coverage tracking on harvest runs
ALTER TABLE public.narrative_harvest_runs
  ADD COLUMN IF NOT EXISTS coverage jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3) Seed query-based feeds for every registered country.
-- Google News RSS by country name + macro keywords, GDELT DOC by ISO, Google News (business).
WITH cc(code, name) AS (
  VALUES
  ('ATG','Antigua and Barbuda'),('BHS','The Bahamas'),('BRB','Barbados'),
  ('BLZ','Belize'),('DMA','Dominica'),('GRD','Grenada'),('GUY','Guyana'),
  ('HTI','Haiti'),('JAM','Jamaica'),('MSR','Montserrat'),
  ('KNA','Saint Kitts and Nevis'),('LCA','Saint Lucia'),
  ('VCT','Saint Vincent and the Grenadines'),('SUR','Suriname'),
  ('TTO','Trinidad and Tobago'),('AIA','Anguilla'),('BMU','Bermuda'),
  ('VGB','British Virgin Islands'),('CYM','Cayman Islands'),
  ('TCA','Turks and Caicos Islands'),('MTQ','Martinique'),('GLP','Guadeloupe')
)
INSERT INTO public.narrative_feeds
  (country_code, scope, kind, endpoint, label, is_seed, is_query, tier_hint, query_template, active)
SELECT code, 'local', 'google_news',
  'https://news.google.com/rss/search?q=' || replace(name,' ','+') || '+(economy+OR+IMF+OR+debt+OR+investment+OR+tourism)&hl=en-US&gl=US&ceid=US:en',
  name || ' · Google News (macro)', true, true, 'query', 'gnews_macro', true
FROM cc
UNION ALL
SELECT code, 'international', 'gdelt',
  'https://api.gdeltproject.org/api/v2/doc/doc?query=sourcecountry:' || code ||
  '+(economy+OR+sovereign+OR+FDI+OR+"central+bank"+OR+IMF)&mode=ArtList&format=json&timespan=1d&maxrecords=40',
  name || ' · GDELT country query', true, true, 'international', 'gdelt_country', true
FROM cc
UNION ALL
SELECT code, 'regional', 'google_news',
  'https://news.google.com/rss/search?q=' || replace(name,' ','+') ||
  '+(CARICOM+OR+OECS+OR+ECCB+OR+CDB+OR+Caribbean)&hl=en-US&gl=US&ceid=US:en',
  name || ' · Regional wires (Google News)', true, true, 'regional', 'gnews_regional', true
FROM cc
ON CONFLICT (country_code, endpoint) DO UPDATE SET
  is_seed = EXCLUDED.is_seed,
  is_query = EXCLUDED.is_query,
  tier_hint = EXCLUDED.tier_hint,
  query_template = EXCLUDED.query_template,
  label = EXCLUDED.label,
  active = true;

-- 4) Mark all existing (non-query) rows as curated seeds so the UI can group them.
UPDATE public.narrative_feeds
   SET is_seed = true
 WHERE is_query = false AND is_seed = false;

-- 5) Cron schedules (idempotent — unschedule before re-scheduling).
DO $$
BEGIN
  PERFORM cron.unschedule('narrative-press-tick-morning');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('narrative-press-tick-evening');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('narrative-press-discover-weekly');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'narrative-press-tick-morning',
  '0 7 * * *',
  $CRON$
  SELECT net.http_post(
    url:='https://project--28b673a0-5141-49a9-b7c6-8a7a9fb07172.lovable.app/api/public/hooks/press-tick',
    headers:='{"Content-Type":"application/json","apikey":"sb_publishable_Xf84ZQhNkD1MxqjSD_wFFg_1tkWk7dj"}'::jsonb,
    body:='{"window":"morning"}'::jsonb
  );
  $CRON$
);

SELECT cron.schedule(
  'narrative-press-tick-evening',
  '0 19 * * *',
  $CRON$
  SELECT net.http_post(
    url:='https://project--28b673a0-5141-49a9-b7c6-8a7a9fb07172.lovable.app/api/public/hooks/press-tick',
    headers:='{"Content-Type":"application/json","apikey":"sb_publishable_Xf84ZQhNkD1MxqjSD_wFFg_1tkWk7dj"}'::jsonb,
    body:='{"window":"evening"}'::jsonb
  );
  $CRON$
);

SELECT cron.schedule(
  'narrative-press-discover-weekly',
  '0 2 * * 0',
  $CRON$
  SELECT net.http_post(
    url:='https://project--28b673a0-5141-49a9-b7c6-8a7a9fb07172.lovable.app/api/public/hooks/press-discover',
    headers:='{"Content-Type":"application/json","apikey":"sb_publishable_Xf84ZQhNkD1MxqjSD_wFFg_1tkWk7dj"}'::jsonb,
    body:='{}'::jsonb
  );
  $CRON$
);
