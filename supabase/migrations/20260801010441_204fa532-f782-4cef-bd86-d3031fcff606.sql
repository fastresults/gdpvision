ALTER TABLE public.persona_projects ADD COLUMN IF NOT EXISTS brief_source jsonb;

-- Promote the first existing upload to the governing brief for programmes
-- created before the brief/context split.
UPDATE public.persona_projects
SET brief_source = (brief_uploads -> 0),
    brief_uploads = COALESCE((
      SELECT jsonb_agg(elem)
      FROM jsonb_array_elements(brief_uploads) WITH ORDINALITY AS t(elem, ord)
      WHERE t.ord > 1
    ), '[]'::jsonb)
WHERE brief_source IS NULL
  AND jsonb_typeof(brief_uploads) = 'array'
  AND jsonb_array_length(brief_uploads) > 0;

COMMENT ON COLUMN public.persona_projects.brief_source IS 'The single governing source brief document for the programme (name, path, mime, size, url, excerpt, captured_at).';
COMMENT ON COLUMN public.persona_projects.brief_uploads IS 'Supporting contextual documents only — the governing brief lives in brief_source.';