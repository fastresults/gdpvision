CREATE INDEX IF NOT EXISTS intake_items_duplicate_of_idx ON public.intake_items (duplicate_of) WHERE duplicate_of IS NOT NULL;
CREATE INDEX IF NOT EXISTS narrative_feed_items_fetched_idx ON public.narrative_feed_items (fetched_at);

CREATE OR REPLACE FUNCTION public.narrative_source_raw_stats()
RETURNS TABLE(feed_id uuid, country_code text, scope text, active boolean, consecutive_failures integer,
  reach_tier smallint, admin_weight numeric, items bigint, relevant bigint, hits bigint,
  primaries bigint, followed bigint, broken bigint, dismissed bigint, confirmed bigint, last_item_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public SET statement_timeout = '120s' AS $$
  WITH followed AS (
    SELECT DISTINCT d.duplicate_of AS sid FROM intake_items d
    WHERE d.duplicate_of IS NOT NULL AND d.created_at > now() - interval '31 days'
  ), agg AS (
    SELECT fi.feed_id,
      count(*) items,
      count(*) FILTER (WHERE fi.state IN ('promoted','duplicate')) relevant,
      count(*) FILTER (WHERE s.id IS NOT NULL AND narrative_priority_level(s.recommendation, s.severity, s.reach) <= 3) hits,
      count(*) FILTER (WHERE fi.state = 'promoted' AND s.story_primary) primaries,
      count(*) FILTER (WHERE fi.state = 'promoted' AND fw.sid IS NOT NULL) followed,
      count(*) FILTER (WHERE s.link_status = 'broken') broken,
      count(*) FILTER (WHERE s.review_verdict = 'noise') dismissed,
      count(*) FILTER (WHERE s.review_verdict = 'confirmed') confirmed,
      max(fi.fetched_at) last_item_at
    FROM narrative_feed_items fi
    LEFT JOIN intake_items s ON s.id = fi.signal_id
    LEFT JOIN followed fw ON fw.sid = fi.signal_id
    WHERE fi.fetched_at > now() - interval '30 days'
    GROUP BY fi.feed_id
  )
  SELECT nf.id, nf.country_code, nf.scope, nf.active, nf.consecutive_failures, nf.reach_tier, nf.admin_weight,
    coalesce(a.items,0), coalesce(a.relevant,0), coalesce(a.hits,0), coalesce(a.primaries,0), coalesce(a.followed,0),
    coalesce(a.broken,0), coalesce(a.dismissed,0), coalesce(a.confirmed,0), a.last_item_at
  FROM narrative_feeds nf LEFT JOIN agg a ON a.feed_id = nf.id;
$$;
REVOKE ALL ON FUNCTION public.narrative_source_raw_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.narrative_source_raw_stats() TO service_role;