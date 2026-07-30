CREATE TABLE public.proforma_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  notes text,
  assumptions jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_version text NOT NULL DEFAULT 'v1_proforma',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proforma_scenarios TO authenticated;
GRANT ALL ON public.proforma_scenarios TO service_role;

ALTER TABLE public.proforma_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global admins manage pro forma scenarios"
ON public.proforma_scenarios
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_proforma_scenarios_updated_at
BEFORE UPDATE ON public.proforma_scenarios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();