CREATE TABLE public.peer_kpi_normalized (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  kpi_code text NOT NULL,
  source_kpi_id uuid,
  raw_value double precision,
  raw_unit text,
  raw_period text,
  value_std double precision,
  unit_std text,
  ref_year integer,
  is_projection boolean NOT NULL DEFAULT false,
  excluded_reason text,
  outlier_flag boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, kpi_code)
);
GRANT SELECT ON public.peer_kpi_normalized TO authenticated;
GRANT ALL ON public.peer_kpi_normalized TO service_role;
ALTER TABLE public.peer_kpi_normalized ENABLE ROW LEVEL SECURITY;
CREATE POLICY "peer_norm_read" ON public.peer_kpi_normalized FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_country_access(auth.uid(), country_code));

CREATE TABLE public.peer_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  kpi_code text NOT NULL,
  label text,
  unit text,
  direction text,
  value double precision,
  ref_year integer,
  median double precision,
  mad double precision,
  peer_min double precision,
  peer_max double precision,
  n integer NOT NULL DEFAULT 0,
  rank integer,
  percentile double precision,
  z double precision,
  gap double precision,
  meaningful boolean NOT NULL DEFAULT false,
  favourable boolean,
  peer_values jsonb NOT NULL DEFAULT '[]'::jsonb,
  period_span text,
  input_hash text NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, kpi_code)
);
GRANT SELECT ON public.peer_benchmarks TO authenticated;
GRANT ALL ON public.peer_benchmarks TO service_role;
ALTER TABLE public.peer_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "peer_bench_read" ON public.peer_benchmarks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_country_access(auth.uid(), country_code));

CREATE TABLE public.peer_gap_explanations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  kpi_code text NOT NULL,
  input_hash text NOT NULL,
  drivers jsonb NOT NULL DEFAULT '[]'::jsonb,
  unknowns text,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, kpi_code)
);
GRANT SELECT ON public.peer_gap_explanations TO authenticated;
GRANT ALL ON public.peer_gap_explanations TO service_role;
ALTER TABLE public.peer_gap_explanations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "peer_expl_read" ON public.peer_gap_explanations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_country_access(auth.uid(), country_code));

CREATE TABLE public.peer_analysis_runs (
  name text PRIMARY KEY,
  status text NOT NULL DEFAULT 'idle',
  lease_until timestamptz,
  pause_reason text,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.peer_analysis_runs TO authenticated;
GRANT ALL ON public.peer_analysis_runs TO service_role;
ALTER TABLE public.peer_analysis_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "peer_runs_admin_read" ON public.peer_analysis_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
INSERT INTO public.peer_analysis_runs(name) VALUES ('regional') ON CONFLICT DO NOTHING;