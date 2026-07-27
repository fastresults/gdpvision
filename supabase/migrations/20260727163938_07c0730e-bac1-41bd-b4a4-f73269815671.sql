CREATE TABLE public.op_ed_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  slug         text NOT NULL,
  event        text NOT NULL,
  visitor_key  text,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  referrer     text
);

GRANT ALL ON public.op_ed_events TO service_role;

ALTER TABLE public.op_ed_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read op-ed events"
  ON public.op_ed_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX op_ed_events_slug_created_idx ON public.op_ed_events (slug, created_at DESC);