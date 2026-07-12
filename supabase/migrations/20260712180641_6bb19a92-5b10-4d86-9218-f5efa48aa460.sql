
-- Ensure pgvector for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- 1. country_sources — canonical, toggleable source registry
-- ============================================================
CREATE TABLE public.country_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  kind TEXT NOT NULL, -- gov | regional | multilateral | advisory | ngo | media | summit | other
  org TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  tld TEXT,
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  active BOOLEAN NOT NULL DEFAULT true,
  quality_score INTEGER NOT NULL DEFAULT 3, -- 1..5
  last_fetched_at TIMESTAMPTZ,
  fetch_status TEXT, -- ok | failed | pending
  fetch_error TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_code, url)
);
CREATE INDEX ON public.country_sources (country_code, kind);
CREATE INDEX ON public.country_sources (country_code, active);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.country_sources TO authenticated;
GRANT ALL ON public.country_sources TO service_role;
ALTER TABLE public.country_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country_sources read bound or admin" ON public.country_sources FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.instance_bindings ib WHERE ib.user_id = auth.uid() AND ib.country_code = country_sources.country_code)
);
CREATE POLICY "country_sources write admin" ON public.country_sources FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER country_sources_updated BEFORE UPDATE ON public.country_sources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2. country_source_documents — scraped raw text
-- ============================================================
CREATE TABLE public.country_source_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_source_id UUID NOT NULL REFERENCES public.country_sources(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.country_source_documents (country_source_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.country_source_documents TO authenticated;
GRANT ALL ON public.country_source_documents TO service_role;
ALTER TABLE public.country_source_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country_source_documents read via source" ON public.country_source_documents FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.country_sources s
  WHERE s.id = country_source_documents.country_source_id
    AND (public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.instance_bindings ib WHERE ib.user_id = auth.uid() AND ib.country_code = s.country_code))
));
CREATE POLICY "country_source_documents write admin" ON public.country_source_documents FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 3. country_source_chunks — embedded chunks for retrieval
-- ============================================================
CREATE TABLE public.country_source_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.country_source_documents(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);
CREATE INDEX ON public.country_source_chunks (country_code);
CREATE INDEX ON public.country_source_chunks USING hnsw (embedding vector_cosine_ops);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.country_source_chunks TO authenticated;
GRANT ALL ON public.country_source_chunks TO service_role;
ALTER TABLE public.country_source_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country_source_chunks read bound or admin" ON public.country_source_chunks FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.instance_bindings ib WHERE ib.user_id = auth.uid() AND ib.country_code = country_source_chunks.country_code)
);
CREATE POLICY "country_source_chunks write admin" ON public.country_source_chunks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 4. country_kpis — canonical KPI seed per country
-- ============================================================
CREATE TABLE public.country_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  kpi_code TEXT NOT NULL, -- e.g. gdp_growth, cpi_yoy, debt_gdp, unemployment
  label TEXT NOT NULL,
  unit TEXT NOT NULL, -- %, USD, index, count
  direction TEXT NOT NULL DEFAULT 'up', -- up | down | flat (better direction)
  category TEXT, -- macro | fiscal | social | external | climate
  source_id UUID REFERENCES public.country_sources(id) ON DELETE SET NULL,
  latest_value NUMERIC,
  latest_period TEXT, -- e.g. 2024, 2024Q3, 2024-10
  target NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_code, kpi_code)
);
CREATE INDEX ON public.country_kpis (country_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.country_kpis TO authenticated;
GRANT ALL ON public.country_kpis TO service_role;
ALTER TABLE public.country_kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country_kpis read bound or admin" ON public.country_kpis FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.instance_bindings ib WHERE ib.user_id = auth.uid() AND ib.country_code = country_kpis.country_code)
);
CREATE POLICY "country_kpis write admin" ON public.country_kpis FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER country_kpis_updated BEFORE UPDATE ON public.country_kpis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 5. country_kpi_points — historical series values
-- ============================================================
CREATE TABLE public.country_kpi_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_kpi_id UUID NOT NULL REFERENCES public.country_kpis(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  value NUMERIC NOT NULL,
  source_id UUID REFERENCES public.country_sources(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_kpi_id, period)
);
CREATE INDEX ON public.country_kpi_points (country_kpi_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.country_kpi_points TO authenticated;
GRANT ALL ON public.country_kpi_points TO service_role;
ALTER TABLE public.country_kpi_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country_kpi_points read via kpi" ON public.country_kpi_points FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.country_kpis k
  WHERE k.id = country_kpi_points.country_kpi_id
    AND (public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (SELECT 1 FROM public.instance_bindings ib WHERE ib.user_id = auth.uid() AND ib.country_code = k.country_code))
));
CREATE POLICY "country_kpi_points write admin" ON public.country_kpi_points FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 6. sector_dossiers — policy / comms / oecs stacks per country×sector
-- ============================================================
CREATE TABLE public.sector_dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  sector_code TEXT NOT NULL,
  kind TEXT NOT NULL, -- policy | comms | oecs
  payload JSONB NOT NULL,
  source_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  confidence TEXT NOT NULL DEFAULT 'medium',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_code, sector_code, kind)
);
CREATE INDEX ON public.sector_dossiers (country_code, sector_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sector_dossiers TO authenticated;
GRANT ALL ON public.sector_dossiers TO service_role;
ALTER TABLE public.sector_dossiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sector_dossiers read bound or admin" ON public.sector_dossiers FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.instance_bindings ib WHERE ib.user_id = auth.uid() AND ib.country_code = sector_dossiers.country_code)
);
CREATE POLICY "sector_dossiers write admin" ON public.sector_dossiers FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER sector_dossiers_updated BEFORE UPDATE ON public.sector_dossiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 7. ministry_profiles — deep-dive per country ministry
-- ============================================================
CREATE TABLE public.ministry_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  ministry_slug TEXT NOT NULL,
  minister TEXT,
  mandate TEXT,
  programmes JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_code, ministry_slug)
);
CREATE INDEX ON public.ministry_profiles (country_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ministry_profiles TO authenticated;
GRANT ALL ON public.ministry_profiles TO service_role;
ALTER TABLE public.ministry_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ministry_profiles read bound or admin" ON public.ministry_profiles FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.instance_bindings ib WHERE ib.user_id = auth.uid() AND ib.country_code = ministry_profiles.country_code)
);
CREATE POLICY "ministry_profiles write admin" ON public.ministry_profiles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER ministry_profiles_updated BEFORE UPDATE ON public.ministry_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
