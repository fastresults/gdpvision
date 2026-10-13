ALTER TABLE public.intake_items
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by uuid,
  ADD COLUMN IF NOT EXISTS flagged_at timestamptz,
  ADD COLUMN IF NOT EXISTS flagged_by uuid,
  ADD COLUMN IF NOT EXISTS flag_note text;

CREATE INDEX IF NOT EXISTS intake_items_kept_idx ON public.intake_items (scope_key, created_at DESC)
  WHERE pinned_at IS NOT NULL OR flagged_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS intake_items_created_idx ON public.intake_items (created_at);

CREATE TABLE public.narrative_retention_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key text NOT NULL,
  removed integer NOT NULL DEFAULT 0,
  ran_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.narrative_retention_runs TO authenticated;
GRANT ALL ON public.narrative_retention_runs TO service_role;
ALTER TABLE public.narrative_retention_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "retention runs read" ON public.narrative_retention_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_country_access(auth.uid(), scope_key));

CREATE OR REPLACE FUNCTION public.narrative_priority_counts(_country_code text)
 RETURNS TABLE(level integer, n bigint) LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
  SELECT public.narrative_priority_level(i.recommendation::text, i.severity::integer, i.reach::integer), count(*)
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
    AND public.narrative_priority_level(i.recommendation::text, i.severity::integer, i.reach::integer) = ANY(_levels)
  ORDER BY (CASE WHEN i.flagged_at IS NOT NULL AND i.pinned_at IS NOT NULL THEN 0 WHEN i.flagged_at IS NOT NULL THEN 1 WHEN i.pinned_at IS NOT NULL THEN 2 ELSE 3 END),
           coalesce(i.severity,0)*20 + coalesce(i.reach,0)*10 DESC,
           i.created_at DESC
  LIMIT least(greatest(coalesce(_limit, 200), 1), 500)
$$;

CREATE OR REPLACE FUNCTION public.purge_stale_signals(_batch integer DEFAULT 5000, _max_batches integer DEFAULT 40)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE total integer := 0; n integer; b integer := 0;
BEGIN
  -- Protect working material: anything with a comms draft is auto-pinned.
  UPDATE public.intake_items i SET pinned_at = now()
  WHERE i.pinned_at IS NULL AND i.flagged_at IS NULL AND i.created_at < now() - interval '30 days'
    AND EXISTS (SELECT 1 FROM public.comms_artifacts c WHERE c.signal_id = i.id);
  LOOP
    WITH victims AS (
      SELECT id, scope_key FROM public.intake_items
      WHERE created_at < now() - interval '30 days' AND pinned_at IS NULL AND flagged_at IS NULL
      LIMIT _batch
    ), cleared AS (
      UPDATE public.comms_artifacts SET signal_id = NULL WHERE signal_id IN (SELECT id FROM victims) RETURNING 1
    ), del AS (
      DELETE FROM public.intake_items WHERE id IN (SELECT id FROM victims) RETURNING scope_key
    ), logged AS (
      INSERT INTO public.narrative_retention_runs (scope_key, removed)
      SELECT scope_key, count(*) FROM del GROUP BY scope_key RETURNING removed
    )
    SELECT coalesce(sum(removed),0) INTO n FROM logged;
    total := total + n; b := b + 1;
    EXIT WHEN n < _batch OR b >= _max_batches;
  END LOOP;
  RETURN total;
END $$;
REVOKE ALL ON FUNCTION public.purge_stale_signals(integer, integer) FROM PUBLIC, anon, authenticated;