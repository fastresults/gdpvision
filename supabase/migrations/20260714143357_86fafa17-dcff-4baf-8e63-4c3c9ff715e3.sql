
-- source_health_checks: one row per poll of a country_source URL
CREATE TABLE public.source_health_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code TEXT NOT NULL,
  source_id UUID NOT NULL REFERENCES public.country_sources(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  http_status INTEGER,
  ok BOOLEAN NOT NULL DEFAULT false,
  latency_ms INTEGER,
  error TEXT
);
CREATE INDEX idx_shc_country_time ON public.source_health_checks(country_code, checked_at DESC);
CREATE INDEX idx_shc_source_time ON public.source_health_checks(source_id, checked_at DESC);
GRANT SELECT, INSERT ON public.source_health_checks TO authenticated;
GRANT ALL ON public.source_health_checks TO service_role;
ALTER TABLE public.source_health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read health checks"
  ON public.source_health_checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Stewards can insert health checks"
  ON public.source_health_checks FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'data_steward'::public.app_role)
  );

-- reconciliation_notes: steward acknowledgement/explanation of unreconciled figures
CREATE TABLE public.reconciliation_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code TEXT NOT NULL,
  subject_kind TEXT NOT NULL, -- 'sector_shares' | 'capital_flows' | 'other'
  subject_key TEXT NOT NULL,   -- e.g. 'composition_total' or a flow node key
  residual_pct NUMERIC,
  note TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID
);
CREATE INDEX idx_recon_country ON public.reconciliation_notes(country_code, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.reconciliation_notes TO authenticated;
GRANT ALL ON public.reconciliation_notes TO service_role;
ALTER TABLE public.reconciliation_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read reconciliation notes"
  ON public.reconciliation_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Stewards can insert reconciliation notes"
  ON public.reconciliation_notes FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'data_steward'::public.app_role)
    )
  );
CREATE POLICY "Stewards can resolve reconciliation notes"
  ON public.reconciliation_notes FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'data_steward'::public.app_role)
  );
