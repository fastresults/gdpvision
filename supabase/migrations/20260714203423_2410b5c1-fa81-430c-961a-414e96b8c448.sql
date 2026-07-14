CREATE TABLE public.ledger_qa_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code text NOT NULL,
  check_key text NOT NULL,
  finding_class text NOT NULL,
  action text NOT NULL,
  rows_before integer,
  rows_after integer,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ledger_qa_actions_country_time_idx
  ON public.ledger_qa_actions (country_code, created_at DESC);

GRANT SELECT ON public.ledger_qa_actions TO authenticated;
GRANT ALL ON public.ledger_qa_actions TO service_role;

ALTER TABLE public.ledger_qa_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read ledger QA actions"
  ON public.ledger_qa_actions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));