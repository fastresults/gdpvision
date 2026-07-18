CREATE OR REPLACE FUNCTION public.find_story_cluster(
  _country text,
  _norm_title text,
  _since timestamptz
) RETURNS TABLE (story_key text, primary_id uuid, similarity real)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT i.story_key, i.id AS primary_id, similarity(lower(i.topic), _norm_title) AS similarity
  FROM public.intake_items i
  WHERE i.scope_key = _country
    AND i.story_primary = true
    AND i.story_key IS NOT NULL
    AND i.created_at >= _since
    AND lower(i.topic) % _norm_title
  ORDER BY similarity(lower(i.topic), _norm_title) DESC
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.find_story_cluster(text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_story_cluster(text, text, timestamptz) TO service_role, authenticated;