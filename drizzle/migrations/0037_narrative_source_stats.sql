ALTER TABLE public.narrative_feeds
  ADD COLUMN IF NOT EXISTS reach_tier smallint CHECK (reach_tier BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS admin_weight numeric NOT NULL DEFAULT 1 CHECK (admin_weight BETWEEN 0.5 AND 1.5);

ALTER TABLE public.intake_items
  ADD COLUMN IF NOT EXISTS source_feed_id uuid,
  ADD COLUMN IF NOT EXISTS source_strength numeric,
  ADD COLUMN IF NOT EXISTS source_tier smallint,
  ADD COLUMN IF NOT EXISTS first_to_report boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_verdict text CHECK (review_verdict IN ('confirmed','noise')),
  ADD COLUMN IF NOT EXISTS review_verdict_at timestamptz;
CREATE INDEX IF NOT EXISTS intake_items_source_feed_idx ON public.intake_items (source_feed_id);
CREATE INDEX IF NOT EXISTS narrative_feed_items_feed_fetched_idx ON public.narrative_feed_items (feed_id, fetched_at);

CREATE TABLE public.narrative_source_stats (
  feed_id uuid PRIMARY KEY REFERENCES public.narrative_feeds(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  items_30d integer NOT NULL DEFAULT 0,
  per_day numeric NOT NULL DEFAULT 0,
  relevance_rate numeric NOT NULL DEFAULT 0,
  hit_rate numeric NOT NULL DEFAULT 0,
  influence_rate numeric NOT NULL DEFAULT 0,
  first_rate numeric NOT NULL DEFAULT 0,
  accuracy numeric NOT NULL DEFAULT 1,
  reach_tier smallint NOT NULL DEFAULT 3,
  strength numeric NOT NULL DEFAULT 40,
  tier smallint NOT NULL DEFAULT 3,
  health text NOT NULL DEFAULT 'working',
  last_item_at timestamptz,
  computed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.narrative_source_stats TO authenticated;
GRANT ALL ON public.narrative_source_stats TO service_role;
ALTER TABLE public.narrative_source_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read source stats" ON public.narrative_source_stats
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Raw 30-day track record per feed; strength/tier are computed in app code.
CREATE OR REPLACE FUNCTION public.narrative_source_raw_stats()
RETURNS TABLE(feed_id uuid, country_code text, scope text, active boolean, consecutive_failures integer,
  reach_tier smallint, admin_weight numeric, items bigint, relevant bigint, hits bigint,
  primaries bigint, followed bigint, broken bigint, dismissed bigint, confirmed bigint, last_item_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH fi AS (
    SELECT i.feed_id, i.state, i.signal_id, i.fetched_at
    FROM narrative_feed_items i
    WHERE i.fetched_at > now() - interval '30 days'
  ), j AS (
    SELECT fi.feed_id, fi.state, fi.fetched_at, s.id sid, s.story_primary, s.link_status, s.review_verdict,
      narrative_priority_level(s.recommendation, s.severity, s.reach) lvl
    FROM fi LEFT JOIN intake_items s ON s.id = fi.signal_id
  ), f AS (
    SELECT s.id sid FROM intake_items s
    WHERE s.created_at > now() - interval '30 days' AND s.story_primary
      AND EXISTS (SELECT 1 FROM intake_items d WHERE d.duplicate_of = s.id)
  )
  SELECT nf.id, nf.country_code, nf.scope, nf.active, nf.consecutive_failures, nf.reach_tier, nf.admin_weight,
    count(j.feed_id),
    count(*) FILTER (WHERE j.state IN ('promoted','duplicate')),
    count(*) FILTER (WHERE j.sid IS NOT NULL AND j.lvl <= 3),
    count(*) FILTER (WHERE j.state = 'promoted' AND j.story_primary),
    count(*) FILTER (WHERE j.state = 'promoted' AND j.sid IN (SELECT sid FROM f)),
    count(*) FILTER (WHERE j.link_status = 'broken'),
    count(*) FILTER (WHERE j.review_verdict = 'noise'),
    count(*) FILTER (WHERE j.review_verdict = 'confirmed'),
    max(j.fetched_at)
  FROM narrative_feeds nf LEFT JOIN j ON j.feed_id = nf.id
  GROUP BY nf.id;
$$;
REVOKE ALL ON FUNCTION public.narrative_source_raw_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.narrative_source_raw_stats() TO service_role;