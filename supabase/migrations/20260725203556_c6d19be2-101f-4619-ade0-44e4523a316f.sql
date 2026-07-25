
CREATE TABLE public.compact_transformational_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compact_id uuid NOT NULL REFERENCES public.mandate_compacts(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  title text,
  subtitle text,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  narrative_signal_id uuid,
  narrative_strategy_id uuid,
  model text,
  authored_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  authored_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (compact_id, version)
);

CREATE INDEX idx_ctp_compact_version ON public.compact_transformational_plans (compact_id, version DESC);
CREATE INDEX idx_ctp_country_status ON public.compact_transformational_plans (country_code, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compact_transformational_plans TO authenticated;
GRANT ALL ON public.compact_transformational_plans TO service_role;

ALTER TABLE public.compact_transformational_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ctp_select_country_access"
  ON public.compact_transformational_plans
  FOR SELECT
  TO authenticated
  USING (public.has_country_access(auth.uid(), country_code));

CREATE POLICY "ctp_insert_country_access"
  ON public.compact_transformational_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE POLICY "ctp_update_country_access"
  ON public.compact_transformational_plans
  FOR UPDATE
  TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE POLICY "ctp_delete_admin"
  ON public.compact_transformational_plans
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER ctp_touch_updated_at
  BEFORE UPDATE ON public.compact_transformational_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
