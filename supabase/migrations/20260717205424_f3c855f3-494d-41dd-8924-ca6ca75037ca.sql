CREATE TABLE public.kpi_seed_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  country_code text NOT NULL,
  kpi_code text NOT NULL,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  pass text NOT NULL DEFAULT 'queued',
  value numeric,
  period text,
  source_url text,
  source_org text,
  notes text,
  inference jsonb,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  diagnostics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, kpi_code)
);

GRANT SELECT ON public.kpi_seed_items TO authenticated;
GRANT ALL ON public.kpi_seed_items TO service_role;

ALTER TABLE public.kpi_seed_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read KPI seed items"
  ON public.kpi_seed_items
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX kpi_seed_items_run_status_idx
  ON public.kpi_seed_items (run_id, status);

CREATE INDEX kpi_seed_items_country_idx
  ON public.kpi_seed_items (country_code);

CREATE INDEX kpi_seed_items_run_pass_idx
  ON public.kpi_seed_items (run_id, pass, status);

CREATE TRIGGER update_kpi_seed_items_updated_at
  BEFORE UPDATE ON public.kpi_seed_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();