CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  tagline text,
  summary text,
  body text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  format text NOT NULL DEFAULT 'in_person' CHECK (format IN ('in_person','online','hybrid')),
  theme text,
  country_code text,
  city text,
  venue text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  registration_close timestamptz,
  capacity integer CHECK (capacity IS NULL OR capacity >= 0),
  hero_url text,
  colour text NOT NULL DEFAULT 'sea' CHECK (colour IN ('sea','coral','mango','palm','night')),
  hosts text[] NOT NULL DEFAULT '{}',
  recording_url text,
  is_placeholder boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published events are public" ON public.events FOR SELECT TO anon, authenticated USING (status = 'published');
CREATE POLICY "Admins read all events" ON public.events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins write events" ON public.events FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.event_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  title text NOT NULL,
  description text,
  speaker_names text[] NOT NULL DEFAULT '{}'
);
GRANT SELECT ON public.event_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_sessions TO authenticated;
GRANT ALL ON public.event_sessions TO service_role;
ALTER TABLE public.event_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sessions of published events are public" ON public.event_sessions FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status = 'published'));
CREATE POLICY "Admins manage sessions" ON public.event_sessions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.event_speakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  role text,
  organisation text,
  photo_url text,
  UNIQUE (event_id, name)
);
GRANT SELECT ON public.event_speakers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_speakers TO authenticated;
GRANT ALL ON public.event_speakers TO service_role;
ALTER TABLE public.event_speakers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Speakers of published events are public" ON public.event_speakers FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status = 'published'));
CREATE POLICY "Admins manage speakers" ON public.event_speakers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.event_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('chamber','country','index','op_ed','page')),
  ref text NOT NULL,
  label text,
  UNIQUE (event_id, kind, ref)
);
GRANT SELECT ON public.event_links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_links TO authenticated;
GRANT ALL ON public.event_links TO service_role;
ALTER TABLE public.event_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Links of published events are public" ON public.event_links FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status = 'published'));
CREATE POLICY "Admins manage links" ON public.event_links FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  email_norm text GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  organisation text,
  role text,
  country text,
  needs text,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','waitlist','cancelled')),
  attended boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, email_norm)
);
GRANT SELECT, UPDATE, DELETE ON public.event_registrations TO authenticated;
GRANT ALL ON public.event_registrations TO service_role;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read registrations" ON public.event_registrations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update registrations" ON public.event_registrations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete registrations" ON public.event_registrations FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.event_host_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  organisation text,
  country text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.event_host_enquiries TO authenticated;
GRANT ALL ON public.event_host_enquiries TO service_role;
ALTER TABLE public.event_host_enquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read enquiries" ON public.event_host_enquiries FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete enquiries" ON public.event_host_enquiries FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Places taken (confirmed) per published event, safe for public display.
CREATE OR REPLACE FUNCTION public.event_seats_taken(_event_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.event_registrations r
  JOIN public.events e ON e.id = r.event_id AND e.status = 'published'
  WHERE r.event_id = _event_id AND r.status = 'confirmed'
$$;
GRANT EXECUTE ON FUNCTION public.event_seats_taken(uuid) TO anon, authenticated, service_role;

-- Atomic registration: validates window, dedupes by email, assigns confirmed or waitlist.
CREATE OR REPLACE FUNCTION public.register_for_event(_slug text, _name text, _email text, _organisation text, _role text, _country text, _needs text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE ev public.events; taken int; st text; existing public.event_registrations;
BEGIN
  SELECT * INTO ev FROM public.events WHERE slug = _slug AND status = 'published' FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('outcome','not_found'); END IF;
  IF COALESCE(ev.registration_close, ev.starts_at) < now() THEN RETURN jsonb_build_object('outcome','closed'); END IF;
  IF length(btrim(coalesce(_name,''))) < 2 OR _email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RETURN jsonb_build_object('outcome','invalid'); END IF;
  SELECT * INTO existing FROM public.event_registrations WHERE event_id = ev.id AND email_norm = lower(btrim(_email));
  IF FOUND THEN RETURN jsonb_build_object('outcome','duplicate','status',existing.status); END IF;
  SELECT count(*) INTO taken FROM public.event_registrations WHERE event_id = ev.id AND status = 'confirmed';
  st := CASE WHEN ev.capacity IS NOT NULL AND taken >= ev.capacity THEN 'waitlist' ELSE 'confirmed' END;
  INSERT INTO public.event_registrations(event_id,name,email,organisation,role,country,needs,status)
  VALUES (ev.id, left(btrim(_name),200), left(btrim(_email),320), left(_organisation,200), left(_role,200), left(_country,120), left(_needs,1000), st);
  RETURN jsonb_build_object('outcome','ok','status',st);
END $$;
REVOKE EXECUTE ON FUNCTION public.register_for_event(text,text,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_for_event(text,text,text,text,text,text,text) TO service_role;