ALTER TABLE public.intake_items
  ADD COLUMN IF NOT EXISTS priority_override smallint,
  ADD COLUMN IF NOT EXISTS priority_raised_from smallint,
  ADD COLUMN IF NOT EXISTS priority_raised_reason text;
ALTER TABLE public.narrative_harvest_runs ADD COLUMN IF NOT EXISTS p1_guarantee jsonb;

CREATE OR REPLACE FUNCTION public.narrative_priority_counts(_country_code text)
 RETURNS TABLE(level integer, n bigint) LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
  SELECT coalesce(i.priority_override::integer, public.narrative_priority_level(i.recommendation::text, i.severity::integer, i.reach::integer)), count(*)
  FROM public.intake_items i
  WHERE i.scope_key = _country_code
    AND (i.story_primary IS TRUE OR i.story_primary IS NULL)
    AND i.state <> 'duplicate'
    AND (i.created_at >= now() - interval '30 days' OR i.pinned_at IS NOT NULL OR i.flagged_at IS NOT NULL)
  GROUP BY 1
$$;

CREATE OR REPLACE FUNCTION public.narrative_signal_ids_at_priority(_country_code text, _levels integer[], _limit integer DEFAULT 200)
 RETURNS TABLE(id uuid) LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
  SELECT i.id FROM public.intake_items i
  WHERE i.scope_key = _country_code
    AND (i.story_primary IS TRUE OR i.story_primary IS NULL)
    AND i.state <> 'duplicate'
    AND (i.created_at >= now() - interval '30 days' OR i.pinned_at IS NOT NULL OR i.flagged_at IS NOT NULL)
    AND coalesce(i.priority_override::integer, public.narrative_priority_level(i.recommendation::text, i.severity::integer, i.reach::integer)) = ANY(_levels)
  ORDER BY (CASE WHEN i.flagged_at IS NOT NULL AND i.pinned_at IS NOT NULL THEN 0 WHEN i.flagged_at IS NOT NULL THEN 1 WHEN i.pinned_at IS NOT NULL THEN 2 ELSE 3 END),
           coalesce(i.severity,0)*20 + coalesce(i.reach,0)*10 DESC,
           i.created_at DESC
  LIMIT least(greatest(coalesce(_limit, 200), 1), 500)
$$;