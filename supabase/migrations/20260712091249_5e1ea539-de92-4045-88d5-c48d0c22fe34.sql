-- kpi_snapshots
CREATE TABLE public.kpi_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id uuid NOT NULL REFERENCES public.kpis(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL DEFAULT now(),
  window_kind text NOT NULL CHECK (window_kind IN ('monthly','quarterly','annual','term')),
  period_label text NOT NULL,
  value numeric,
  target numeric,
  variance_pct numeric,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX kpi_snapshots_kpi_idx ON public.kpi_snapshots (kpi_id, captured_at DESC);
CREATE INDEX kpi_snapshots_window_idx ON public.kpi_snapshots (window_kind, period_label);

GRANT SELECT ON public.kpi_snapshots TO authenticated;
GRANT ALL ON public.kpi_snapshots TO service_role;
ALTER TABLE public.kpi_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kpi_snapshots_read" ON public.kpi_snapshots FOR SELECT TO authenticated USING (true);

-- cadence_closes
CREATE TABLE public.cadence_closes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  window_kind text NOT NULL CHECK (window_kind IN ('monthly','quarterly','annual','term')),
  period_label text NOT NULL,
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  snapshot_count integer NOT NULL DEFAULT 0,
  notes text,
  UNIQUE (window_kind, period_label)
);
GRANT SELECT ON public.cadence_closes TO authenticated;
GRANT ALL ON public.cadence_closes TO service_role;
ALTER TABLE public.cadence_closes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cadence_closes_read" ON public.cadence_closes FOR SELECT TO authenticated USING (true);

-- sector_edges (ripple adjacency)
CREATE TABLE public.sector_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_sector text NOT NULL,
  to_sector text NOT NULL,
  weight numeric NOT NULL DEFAULT 0.1 CHECK (weight >= 0 AND weight <= 1),
  order_rank integer NOT NULL DEFAULT 2 CHECK (order_rank IN (1,2,3)),
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (from_sector, to_sector)
);
CREATE INDEX sector_edges_from_idx ON public.sector_edges (from_sector);
GRANT SELECT ON public.sector_edges TO authenticated;
GRANT ALL ON public.sector_edges TO service_role;
ALTER TABLE public.sector_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sector_edges_read" ON public.sector_edges FOR SELECT TO authenticated USING (true);
CREATE POLICY "sector_edges_admin_write" ON public.sector_edges FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'data_steward'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'data_steward'));

-- exports_documents (rendered document artifacts)
CREATE TABLE public.exports_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('cabinet_decision','briefing_pack','fdi_package','term_report','state_of_mandate')),
  source_id uuid,
  title text NOT NULL,
  html text NOT NULL,
  scope_key text,
  rendered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rendered_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX exports_documents_kind_idx ON public.exports_documents (kind, rendered_at DESC);
GRANT SELECT ON public.exports_documents TO authenticated;
GRANT ALL ON public.exports_documents TO service_role;
ALTER TABLE public.exports_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exports_documents_read" ON public.exports_documents FOR SELECT TO authenticated USING (true);