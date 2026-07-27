CREATE TABLE public.op_ed_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  slug         text NOT NULL,
  chamber      text NOT NULL,
  name         text NOT NULL,
  role         text NOT NULL,
  organisation text NOT NULL,
  email        text NOT NULL,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  utm_content  text,
  referrer     text,
  user_agent   text,
  status       text NOT NULL DEFAULT 'new'
);

GRANT ALL ON public.op_ed_requests TO service_role;

ALTER TABLE public.op_ed_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read op-ed requests"
  ON public.op_ed_requests
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX op_ed_requests_created_at_idx ON public.op_ed_requests (created_at DESC);
CREATE INDEX op_ed_requests_slug_idx ON public.op_ed_requests (slug);
CREATE INDEX op_ed_requests_email_idx ON public.op_ed_requests (lower(email));