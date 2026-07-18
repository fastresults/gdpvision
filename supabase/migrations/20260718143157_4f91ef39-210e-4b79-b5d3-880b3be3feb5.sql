
-- ============================================================
-- narrative_feeds — the source catalogue per country
-- ============================================================
CREATE TABLE IF NOT EXISTS public.narrative_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('local','regional','international')),
  kind text NOT NULL CHECK (kind IN ('rss','json','gdelt','google_news','html')),
  endpoint text NOT NULL,
  label text,
  language text DEFAULT 'en',
  sector_hint text,
  ministry_hint text,
  weight numeric NOT NULL DEFAULT 1.0,
  active boolean NOT NULL DEFAULT true,
  last_polled_at timestamptz,
  last_status text,
  last_error text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  etag text,
  last_hash text,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  owner_country_code text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, endpoint)
);

CREATE INDEX IF NOT EXISTS narrative_feeds_country_active_idx
  ON public.narrative_feeds (country_code, active);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.narrative_feeds TO authenticated;
GRANT ALL ON public.narrative_feeds TO service_role;

ALTER TABLE public.narrative_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY narrative_feeds_read
  ON public.narrative_feeds FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::public.app_role)
    OR public.has_country_access(auth.uid(), country_code)
  );

CREATE POLICY narrative_feeds_write
  ON public.narrative_feeds FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::public.app_role)
    OR public.has_country_role(auth.uid(),'country_admin'::public.app_role, country_code)
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin'::public.app_role)
    OR public.has_country_role(auth.uid(),'country_admin'::public.app_role, country_code)
  );

CREATE TRIGGER narrative_feeds_touch
  BEFORE UPDATE ON public.narrative_feeds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- narrative_feed_items — raw press hits
-- ============================================================
CREATE TABLE IF NOT EXISTS public.narrative_feed_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id uuid NOT NULL REFERENCES public.narrative_feeds(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  guid_hash text NOT NULL,
  url text,
  title text,
  raw_excerpt text,
  published_at timestamptz,
  state text NOT NULL DEFAULT 'new' CHECK (state IN ('new','classified','promoted','discarded','duplicate','error')),
  signal_id uuid REFERENCES public.intake_items(id) ON DELETE SET NULL,
  error text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (feed_id, guid_hash)
);

CREATE INDEX IF NOT EXISTS narrative_feed_items_country_state_idx
  ON public.narrative_feed_items (country_code, state, fetched_at DESC);

GRANT SELECT ON public.narrative_feed_items TO authenticated;
GRANT ALL ON public.narrative_feed_items TO service_role;

ALTER TABLE public.narrative_feed_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY narrative_feed_items_read
  ON public.narrative_feed_items FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::public.app_role)
    OR public.has_country_access(auth.uid(), country_code)
  );

-- ============================================================
-- narrative_harvest_runs — one row per cron tick
-- ============================================================
CREATE TABLE IF NOT EXISTS public.narrative_harvest_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  window_key text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  countries_run text[] NOT NULL DEFAULT '{}',
  feeds_polled integer NOT NULL DEFAULT 0,
  items_fetched integer NOT NULL DEFAULT 0,
  items_new integer NOT NULL DEFAULT 0,
  items_promoted integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  triggered_by text NOT NULL DEFAULT 'cron'
);

CREATE INDEX IF NOT EXISTS narrative_harvest_runs_started_idx
  ON public.narrative_harvest_runs (started_at DESC);

GRANT SELECT ON public.narrative_harvest_runs TO authenticated;
GRANT ALL ON public.narrative_harvest_runs TO service_role;

ALTER TABLE public.narrative_harvest_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY narrative_harvest_runs_read
  ON public.narrative_harvest_runs FOR SELECT TO authenticated
  USING (true);
