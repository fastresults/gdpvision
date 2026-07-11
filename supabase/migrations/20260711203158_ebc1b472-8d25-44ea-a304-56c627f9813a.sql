
CREATE TABLE public.briefing_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  role text NOT NULL,
  government text NOT NULL,
  nation text NOT NULL,
  email text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'new',
  user_agent text
);

GRANT INSERT ON public.briefing_requests TO anon;
GRANT INSERT ON public.briefing_requests TO authenticated;
GRANT ALL ON public.briefing_requests TO service_role;

ALTER TABLE public.briefing_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a briefing request"
  ON public.briefing_requests
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX briefing_requests_created_at_idx
  ON public.briefing_requests (created_at DESC);
