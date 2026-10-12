CREATE OR REPLACE FUNCTION public.narrative_priority_level(_rec text, _sev integer, _reach integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _rec IN ('lead','counter') THEN CASE WHEN coalesce(_sev,0) >= 4 OR coalesce(_reach,0) >= 4 THEN 1 ELSE 2 END
    WHEN _rec = 'amplify' THEN CASE WHEN coalesce(_sev,0) >= 4 THEN 2 ELSE 3 END
    WHEN _rec = 'monitor' THEN 4
    WHEN _rec = 'ignore' THEN 5
    WHEN coalesce(_sev,0) >= 4 OR coalesce(_reach,0) >= 4 THEN 2
    WHEN coalesce(_sev,0) >= 2 OR coalesce(_reach,0) >= 2 THEN 4
    ELSE 5
  END
$$;

CREATE OR REPLACE FUNCTION public.narrative_priority_counts(_country_code text)
RETURNS TABLE(level integer, n bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.narrative_priority_level(i.recommendation::text, i.severity::integer, i.reach::integer) AS level,
         count(*) AS n
  FROM public.intake_items i
  WHERE i.scope_key = _country_code
    AND (i.story_primary IS TRUE OR i.story_primary IS NULL)
    AND i.state <> 'duplicate'
  GROUP BY 1
$$;

CREATE OR REPLACE FUNCTION public.narrative_signal_ids_at_priority(_country_code text, _levels integer[], _limit integer DEFAULT 200)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT i.id
  FROM public.intake_items i
  WHERE i.scope_key = _country_code
    AND (i.story_primary IS TRUE OR i.story_primary IS NULL)
    AND i.state <> 'duplicate'
    AND public.narrative_priority_level(i.recommendation::text, i.severity::integer, i.reach::integer) = ANY(_levels)
  ORDER BY i.created_at DESC
  LIMIT least(greatest(coalesce(_limit, 200), 1), 500)
$$;

REVOKE ALL ON FUNCTION public.narrative_priority_counts(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.narrative_signal_ids_at_priority(text, integer[], integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.narrative_priority_level(text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.narrative_priority_counts(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.narrative_signal_ids_at_priority(text, integer[], integer) TO authenticated, service_role;