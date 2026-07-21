DROP INDEX IF EXISTS public.studies_one_draft_per_segment_idx;

CREATE UNIQUE INDEX studies_one_draft_per_segment_project_idx
ON public.studies (country_code, project_id, segment_id)
WHERE status = 'draft' AND segment_id IS NOT NULL AND project_id IS NOT NULL;

CREATE UNIQUE INDEX studies_one_draft_per_segment_legacy_idx
ON public.studies (country_code, segment_id)
WHERE status = 'draft' AND segment_id IS NOT NULL AND project_id IS NULL;