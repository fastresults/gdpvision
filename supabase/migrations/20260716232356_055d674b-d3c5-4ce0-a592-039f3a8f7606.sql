CREATE TABLE public.ministry_deep_dive_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  country_code text NOT NULL,
  ministry_slug text NOT NULL,
  ministry_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  minister text,
  minister_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  mandate text,
  programmes jsonb NOT NULL DEFAULT '[]'::jsonb,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence text,
  source_tier text,
  diagnostics jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, ministry_slug)
);

GRANT SELECT ON public.ministry_deep_dive_items TO authenticated;
GRANT ALL ON public.ministry_deep_dive_items TO service_role;

ALTER TABLE public.ministry_deep_dive_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read deep-dive items"
  ON public.ministry_deep_dive_items
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX ministry_deep_dive_items_run_status_idx
  ON public.ministry_deep_dive_items (run_id, status);

CREATE INDEX ministry_deep_dive_items_country_idx
  ON public.ministry_deep_dive_items (country_code);

CREATE TRIGGER update_ministry_deep_dive_items_updated_at
  BEFORE UPDATE ON public.ministry_deep_dive_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
