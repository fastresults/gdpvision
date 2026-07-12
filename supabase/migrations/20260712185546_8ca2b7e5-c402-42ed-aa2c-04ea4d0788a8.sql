
-- 1. New columns on country_sources
ALTER TABLE public.country_sources
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS summary_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS connection_kind text; -- 'link' | 'document' | 'api' | 'mcp'

-- Per-KPI citation URL (so we can collapse the source rows without losing exact refs)
ALTER TABLE public.country_kpis ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE public.country_kpi_points ADD COLUMN IF NOT EXISTS source_url text;

-- 2. Backfill source_url from the existing per-URL source rows before merging
UPDATE public.country_kpis k
SET source_url = s.url
FROM public.country_sources s
WHERE k.source_id = s.id AND k.source_url IS NULL;

UPDATE public.country_kpi_points p
SET source_url = s.url
FROM public.country_sources s
WHERE p.source_id = s.id AND p.source_url IS NULL;

-- 3. Merge duplicate kpi_source rows per (country_code, lower(org))
WITH ranked AS (
  SELECT id, country_code, lower(org) AS org_l,
         row_number() OVER (PARTITION BY country_code, lower(org) ORDER BY created_at ASC, id) AS rn,
         first_value(id) OVER (PARTITION BY country_code, lower(org) ORDER BY created_at ASC, id) AS keep_id
  FROM public.country_sources
  WHERE kind = 'kpi_source'
),
losers AS (SELECT id, keep_id FROM ranked WHERE rn > 1)
UPDATE public.country_kpis k
SET source_id = l.keep_id
FROM losers l WHERE k.source_id = l.id;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY country_code, lower(org) ORDER BY created_at ASC, id) AS rn,
         first_value(id) OVER (PARTITION BY country_code, lower(org) ORDER BY created_at ASC, id) AS keep_id
  FROM public.country_sources
  WHERE kind = 'kpi_source'
),
losers AS (SELECT id, keep_id FROM ranked WHERE rn > 1)
UPDATE public.country_kpi_points p
SET source_id = l.keep_id
FROM losers l WHERE p.source_id = l.id;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY country_code, lower(org) ORDER BY created_at ASC, id) AS rn,
         first_value(id) OVER (PARTITION BY country_code, lower(org) ORDER BY created_at ASC, id) AS keep_id
  FROM public.country_sources
  WHERE kind = 'kpi_source'
),
losers AS (SELECT id, keep_id FROM ranked WHERE rn > 1)
UPDATE public.country_source_documents d
SET country_source_id = l.keep_id
FROM losers l WHERE d.country_source_id = l.id;

DELETE FROM public.country_sources cs
USING (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY country_code, lower(org) ORDER BY created_at ASC, id) AS rn
    FROM public.country_sources WHERE kind = 'kpi_source'
  ) r WHERE r.rn > 1
) losers
WHERE cs.id = losers.id;

-- 4. Retitle the merged kpi_source rows to canonical org names
UPDATE public.country_sources
SET title = org || ' — data portal',
    url = CASE
      WHEN lower(org) LIKE 'world bank%' THEN 'https://data.worldbank.org/country/' || country_code
      WHEN lower(org) = 'imf' THEN 'https://www.imf.org/en/countries/' || country_code
      WHEN lower(org) LIKE 'imf weo%' THEN 'https://www.imf.org/en/Publications/WEO'
      WHEN lower(org) = 'undp' THEN 'https://hdr.undp.org/data-center/country-insights'
      WHEN lower(org) = 'who' THEN 'https://data.who.int/countries'
      WHEN lower(org) = 'ilo' THEN 'https://ilostat.ilo.org/data/country-profiles/'
      ELSE url
    END
WHERE kind = 'kpi_source';

-- 5. Deduplicate any leftover exact (country_code, url) collisions across all kinds
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY country_code, url ORDER BY created_at ASC, id) AS rn,
         first_value(id) OVER (PARTITION BY country_code, url ORDER BY created_at ASC, id) AS keep_id
  FROM public.country_sources
),
losers AS (SELECT id, keep_id FROM ranked WHERE rn > 1)
UPDATE public.country_kpis k SET source_id = l.keep_id FROM losers l WHERE k.source_id = l.id;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY country_code, url ORDER BY created_at ASC, id) AS rn,
         first_value(id) OVER (PARTITION BY country_code, url ORDER BY created_at ASC, id) AS keep_id
  FROM public.country_sources
),
losers AS (SELECT id, keep_id FROM ranked WHERE rn > 1)
UPDATE public.country_kpi_points p SET source_id = l.keep_id FROM losers l WHERE p.source_id = l.id;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY country_code, url ORDER BY created_at ASC, id) AS rn,
         first_value(id) OVER (PARTITION BY country_code, url ORDER BY created_at ASC, id) AS keep_id
  FROM public.country_sources
),
losers AS (SELECT id, keep_id FROM ranked WHERE rn > 1)
UPDATE public.country_source_documents d SET country_source_id = l.keep_id FROM losers l WHERE d.country_source_id = l.id;

DELETE FROM public.country_sources cs
USING (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY country_code, url ORDER BY created_at ASC, id) AS rn
    FROM public.country_sources
  ) r WHERE r.rn > 1
) losers WHERE cs.id = losers.id;

-- 6. Partial unique index: one KPI-provider row per country per org
CREATE UNIQUE INDEX IF NOT EXISTS country_sources_kpi_org_uniq
  ON public.country_sources (country_code, lower(org))
  WHERE kind = 'kpi_source';

-- 7. Country source connections (API / MCP)
CREATE TABLE IF NOT EXISTS public.country_source_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_source_id uuid NOT NULL UNIQUE REFERENCES public.country_sources(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('api','mcp')),
  endpoint_url text NOT NULL,
  auth_header_name text,
  secret_ref text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_polled_at timestamptz,
  last_status text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.country_source_connections TO authenticated;
GRANT ALL ON public.country_source_connections TO service_role;

ALTER TABLE public.country_source_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "csc admin all"
  ON public.country_source_connections
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER csc_updated
  BEFORE UPDATE ON public.country_source_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
