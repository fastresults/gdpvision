ALTER TABLE public.sector_dossiers
  ADD COLUMN IF NOT EXISTS citations jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Best-effort backfill: for dossiers without citations, pull the latest
-- sector_dossier-stage draft's citations for that country (ordered by insertion).
WITH latest_draft AS (
  SELECT DISTINCT ON (d.country_code) d.country_code, d.id AS draft_id
  FROM public.onboarding_drafts d
  WHERE d.stage = 'sector_dossier'
  ORDER BY d.country_code, d.created_at DESC
),
draft_cites AS (
  SELECT
    ld.country_code,
    jsonb_agg(
      jsonb_build_object(
        'url', c.url,
        'title', c.title,
        'domain', c.domain,
        'quote', c.quote,
        'published_at', c.published_at
      )
      ORDER BY c.created_at, c.id
    ) AS citations
  FROM latest_draft ld
  JOIN public.onboarding_citations c ON c.draft_id = ld.draft_id
  GROUP BY ld.country_code
)
UPDATE public.sector_dossiers sd
SET citations = dc.citations
FROM draft_cites dc
WHERE sd.country_code = dc.country_code
  AND (sd.citations IS NULL OR sd.citations = '[]'::jsonb);