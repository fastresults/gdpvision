UPDATE public.persona_projects
   SET brief_committed_at = NULL,
       brief_raw = NULL
 WHERE brief_committed_at IS NOT NULL
   AND COALESCE(jsonb_array_length(brief_uploads), 0) = 0
   AND lower(btrim(COALESCE(brief_raw, ''))) = lower(btrim(COALESCE(title, '')));