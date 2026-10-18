ALTER TABLE public.intake_items
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS countries text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_political boolean,
  ADD COLUMN IF NOT EXISTS is_economic boolean,
  ADD COLUMN IF NOT EXISTS mentions_government boolean,
  ADD COLUMN IF NOT EXISTS link_status text,
  ADD COLUMN IF NOT EXISTS link_final_url text,
  ADD COLUMN IF NOT EXISTS link_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS priority_score numeric,
  ADD COLUMN IF NOT EXISTS priority_factors jsonb;
CREATE INDEX IF NOT EXISTS intake_items_tags_gin ON public.intake_items USING gin (tags);
CREATE INDEX IF NOT EXISTS intake_items_countries_gin ON public.intake_items USING gin (countries);

CREATE TABLE public.narrative_media_countries (
  code text PRIMARY KEY,
  name text NOT NULL,
  region text NOT NULL DEFAULT 'caribbean',
  is_regional boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.narrative_media_countries TO authenticated;
GRANT ALL ON public.narrative_media_countries TO service_role;
ALTER TABLE public.narrative_media_countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage media countries" ON public.narrative_media_countries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.narrative_outlets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  domain text NOT NULL UNIQUE,
  feed_url text,
  scope text NOT NULL DEFAULT 'regional' CHECK (scope IN ('regional','international')),
  credibility smallint NOT NULL DEFAULT 3 CHECK (credibility BETWEEN 1 AND 5),
  focus text[] NOT NULL DEFAULT '{politics,economy}',
  active boolean NOT NULL DEFAULT true,
  feed_status text,
  last_synced_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.narrative_outlets TO authenticated;
GRANT ALL ON public.narrative_outlets TO service_role;
ALTER TABLE public.narrative_outlets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage outlets" ON public.narrative_outlets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.narrative_scan_locks (
  name text PRIMARY KEY,
  holder text NOT NULL,
  expires_at timestamptz NOT NULL
);
GRANT ALL ON public.narrative_scan_locks TO service_role;
ALTER TABLE public.narrative_scan_locks ENABLE ROW LEVEL SECURITY;