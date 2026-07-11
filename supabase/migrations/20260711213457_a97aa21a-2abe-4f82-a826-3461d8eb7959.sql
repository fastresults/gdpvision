
ALTER TABLE public.countries
  ADD COLUMN IF NOT EXISTS signature_json jsonb,
  ADD COLUMN IF NOT EXISTS signature_generated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.keying_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  total_checked integer NOT NULL DEFAULT 0,
  total_violations integer NOT NULL DEFAULT 0,
  report jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT ON public.keying_audits TO authenticated;
GRANT ALL ON public.keying_audits TO service_role;

ALTER TABLE public.keying_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view keying audits"
  ON public.keying_audits FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
