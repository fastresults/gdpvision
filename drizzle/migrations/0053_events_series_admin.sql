CREATE TABLE public.event_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  short_name text,
  site_url text NOT NULL UNIQUE,
  sector text,
  colour text NOT NULL DEFAULT 'sea' CHECK (colour IN ('sea','coral','mango','palm','night')),
  logo_url text,
  summary text,
  position integer NOT NULL DEFAULT 0,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.event_series TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_series TO authenticated;
GRANT ALL ON public.event_series TO service_role;
ALTER TABLE public.event_series ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Series are public" ON public.event_series FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage series" ON public.event_series FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES public.event_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS edition_label text,
  ADD COLUMN IF NOT EXISTS date_tba boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.events ALTER COLUMN starts_at DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS events_series_edition_uq ON public.events(series_id, edition_label) WHERE series_id IS NOT NULL AND edition_label IS NOT NULL;
UPDATE public.events SET archived = true WHERE is_placeholder = true;

CREATE TABLE public.event_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  tier text,
  logo_url text,
  url text,
  position integer NOT NULL DEFAULT 0,
  UNIQUE (event_id, name)
);
GRANT SELECT ON public.event_partners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_partners TO authenticated;
GRANT ALL ON public.event_partners TO service_role;
ALTER TABLE public.event_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Partners of published events are public" ON public.event_partners FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status = 'published'));
CREATE POLICY "Admins manage partners" ON public.event_partners FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.event_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'photo' CHECK (kind IN ('photo','recording','deck')),
  url text NOT NULL,
  caption text,
  credit text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, url)
);
GRANT SELECT ON public.event_media TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_media TO authenticated;
GRANT ALL ON public.event_media TO service_role;
ALTER TABLE public.event_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Media of published events are public" ON public.event_media FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status = 'published'));
CREATE POLICY "Admins manage media" ON public.event_media FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.event_site_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES public.event_series(id) ON DELETE CASCADE,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  extracted jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied boolean NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_site_snapshots TO authenticated;
GRANT ALL ON public.event_site_snapshots TO service_role;
ALTER TABLE public.event_site_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage snapshots" ON public.event_site_snapshots FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS checkin_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_checkin_token_uq ON public.event_registrations(checkin_token);

-- Check-in happens at most once: returns outcome without overwriting an earlier check-in.
CREATE OR REPLACE FUNCTION public.event_check_in(_token uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.event_registrations;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO r FROM public.event_registrations WHERE checkin_token = _token FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('outcome','not_found'); END IF;
  IF r.status = 'cancelled' THEN RETURN jsonb_build_object('outcome','cancelled','name',r.name); END IF;
  IF r.checked_in_at IS NOT NULL THEN RETURN jsonb_build_object('outcome','already','name',r.name,'at',r.checked_in_at); END IF;
  UPDATE public.event_registrations SET checked_in_at = now(), attended = true WHERE id = r.id;
  RETURN jsonb_build_object('outcome','ok','name',r.name);
END $$;
REVOKE EXECUTE ON FUNCTION public.event_check_in(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.event_check_in(uuid) TO authenticated, service_role;