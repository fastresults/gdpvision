
-- Remove duplicate drafts (keep oldest per country+segment among drafts)
DELETE FROM public.studies s
USING public.studies dup
WHERE s.id <> dup.id
  AND s.country_code = dup.country_code
  AND s.segment_id = dup.segment_id
  AND s.status = 'draft'
  AND dup.status = 'draft'
  AND s.created_at > dup.created_at;

-- Enforce: at most one DRAFT study per (country, segment)
CREATE UNIQUE INDEX IF NOT EXISTS studies_one_draft_per_segment_idx
  ON public.studies (country_code, segment_id)
  WHERE status = 'draft' AND segment_id IS NOT NULL;
