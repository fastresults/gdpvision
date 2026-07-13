-- Phase 1: onboarding reliability foundation

-- 1) Allow 'stale' status so stuck-run auto-reconciliation actually works
ALTER TABLE public.onboarding_runs DROP CONSTRAINT IF EXISTS onboarding_runs_status_check;
ALTER TABLE public.onboarding_runs ADD CONSTRAINT onboarding_runs_status_check
  CHECK (status = ANY (ARRAY['queued','planning','searching','extracting','validating','ready','committed','failed','cancelled','stale']::text[]));

-- 2) One live open run per (country, stage) — blocks concurrent runs from two tabs
DROP INDEX IF EXISTS public.onboarding_runs_one_open_per_stage;
CREATE UNIQUE INDEX onboarding_runs_one_open_per_stage
  ON public.onboarding_runs (country_code, stage)
  WHERE status IN ('queued','planning','searching','extracting','validating');

-- 3) One live (uncommitted) draft per (country, stage). First collapse duplicates by keeping newest.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY country_code, stage ORDER BY created_at DESC) AS rn
  FROM public.onboarding_drafts
  WHERE committed_at IS NULL
)
DELETE FROM public.onboarding_drafts d USING ranked r
  WHERE d.id = r.id AND r.rn > 1;

DROP INDEX IF EXISTS public.onboarding_drafts_one_live_per_stage;
CREATE UNIQUE INDEX onboarding_drafts_one_live_per_stage
  ON public.onboarding_drafts (country_code, stage)
  WHERE committed_at IS NULL;

-- 4) Explicit commit timestamps for profile / gdp (fixes false-positive "committed" ground truth)
ALTER TABLE public.countries ADD COLUMN IF NOT EXISTS profile_committed_at timestamptz;
ALTER TABLE public.countries ADD COLUMN IF NOT EXISTS gdp_committed_at timestamptz;

-- Backfill from onboarding_runs where a committed run exists
UPDATE public.countries c SET profile_committed_at = r.finished_at
  FROM (
    SELECT DISTINCT ON (country_code) country_code, COALESCE(finished_at, started_at) AS finished_at
    FROM public.onboarding_runs
    WHERE stage='profile' AND status='committed'
    ORDER BY country_code, COALESCE(finished_at, started_at) DESC
  ) r
  WHERE c.code = r.country_code AND c.profile_committed_at IS NULL;

UPDATE public.countries c SET gdp_committed_at = r.finished_at
  FROM (
    SELECT DISTINCT ON (country_code) country_code, COALESCE(finished_at, started_at) AS finished_at
    FROM public.onboarding_runs
    WHERE stage='gdp' AND status='committed'
    ORDER BY country_code, COALESCE(finished_at, started_at) DESC
  ) r
  WHERE c.code = r.country_code AND c.gdp_committed_at IS NULL;

-- 5) Transactional replace helpers so commit(delete+insert) can't leave the table empty on crash
CREATE OR REPLACE FUNCTION public.replace_country_sectors(
  _country_code text,
  _rows jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  DELETE FROM public.country_sectors WHERE country_code = _country_code;
  INSERT INTO public.country_sectors (country_code, sector_code, sector_label, gdp_share_pct, employment_share_pct, notes)
    SELECT _country_code,
           (elem->>'sector_code')::text,
           (elem->>'sector_label')::text,
           NULLIF(elem->>'gdp_share_pct','')::numeric,
           NULLIF(elem->>'employment_share_pct','')::numeric,
           NULLIF(elem->>'notes','')::text
    FROM jsonb_array_elements(_rows) AS elem;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
GRANT EXECUTE ON FUNCTION public.replace_country_sectors(text, jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.replace_ministry_sectors(
  _country_code text,
  _rows jsonb
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  DELETE FROM public.ministry_sectors ms
    USING public.ministries m
    WHERE ms.ministry_id = m.id AND m.country_code = _country_code;
  INSERT INTO public.ministry_sectors (ministry_id, sector_code, weight)
    SELECT m.id,
           (elem->>'sector_code')::text,
           COALESCE(NULLIF(elem->>'weight','')::numeric, 1.0)
    FROM jsonb_array_elements(_rows) AS elem
    JOIN public.ministries m
      ON m.country_code = _country_code
     AND m.slug = (elem->>'ministry_slug')::text;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
GRANT EXECUTE ON FUNCTION public.replace_ministry_sectors(text, jsonb) TO authenticated, service_role;