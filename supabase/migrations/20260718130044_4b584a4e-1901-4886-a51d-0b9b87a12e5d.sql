
-- fdi_threats: one row per Chamber 04 Act 1 submission
CREATE TABLE public.fdi_threats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  name text NOT NULL,
  threat_type text NOT NULL,
  target_sector_codes text[] NOT NULL DEFAULT '{}',
  severity_pct numeric NOT NULL DEFAULT 50,
  horizon_years integer NOT NULL DEFAULT 5,
  onset text NOT NULL DEFAULT 'phased',
  brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility text NOT NULL DEFAULT 'public',
  owner_country_code text,
  uploaded_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fdi_threats TO authenticated;
GRANT ALL ON public.fdi_threats TO service_role;

ALTER TABLE public.fdi_threats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fdi_threats admin all"
  ON public.fdi_threats FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "fdi_threats country access read"
  ON public.fdi_threats FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (visibility = 'public' AND public.has_country_access(auth.uid(), country_code))
    OR (visibility = 'private' AND public.has_country_access(auth.uid(), country_code))
  );

CREATE POLICY "fdi_threats country access write"
  ON public.fdi_threats FOR INSERT TO authenticated
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE POLICY "fdi_threats country access update"
  ON public.fdi_threats FOR UPDATE TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE TRIGGER fdi_threats_set_updated_at
  BEFORE UPDATE ON public.fdi_threats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER fdi_threats_enforce_private
  BEFORE INSERT OR UPDATE ON public.fdi_threats
  FOR EACH ROW EXECUTE FUNCTION public.enforce_private_ownership();

CREATE INDEX fdi_threats_country_idx ON public.fdi_threats(country_code, created_at DESC);


-- fdi_strategies: one row per Act 2 canvas state, linked to a threat
CREATE TABLE public.fdi_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fdi_threat_id uuid NOT NULL REFERENCES public.fdi_threats(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  name text NOT NULL,
  allocation jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft',
  promoted_scenario_id uuid,
  promoted_at timestamptz,
  visibility text NOT NULL DEFAULT 'public',
  owner_country_code text,
  uploaded_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fdi_strategies TO authenticated;
GRANT ALL ON public.fdi_strategies TO service_role;

ALTER TABLE public.fdi_strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fdi_strategies admin all"
  ON public.fdi_strategies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "fdi_strategies country access read"
  ON public.fdi_strategies FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_country_access(auth.uid(), country_code)
  );

CREATE POLICY "fdi_strategies country access write"
  ON public.fdi_strategies FOR INSERT TO authenticated
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE POLICY "fdi_strategies country access update"
  ON public.fdi_strategies FOR UPDATE TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE TRIGGER fdi_strategies_set_updated_at
  BEFORE UPDATE ON public.fdi_strategies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER fdi_strategies_enforce_private
  BEFORE INSERT OR UPDATE ON public.fdi_strategies
  FOR EACH ROW EXECUTE FUNCTION public.enforce_private_ownership();

CREATE INDEX fdi_strategies_threat_idx ON public.fdi_strategies(fdi_threat_id);
CREATE INDEX fdi_strategies_country_idx ON public.fdi_strategies(country_code, created_at DESC);
