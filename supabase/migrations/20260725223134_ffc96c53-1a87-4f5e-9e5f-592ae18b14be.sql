
-- fdi_posture_snapshots
CREATE TABLE public.fdi_posture_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code TEXT NOT NULL,
  posture_score NUMERIC NOT NULL,
  components JSONB NOT NULL DEFAULT '{}'::jsonb,
  peer_country_codes TEXT[] NOT NULL DEFAULT '{}',
  capital_gap_usd NUMERIC,
  capital_gap_pct_gdp NUMERIC,
  investor_value_prop TEXT,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_model TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX fdi_posture_snapshots_country_idx
  ON public.fdi_posture_snapshots (country_code, generated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fdi_posture_snapshots TO authenticated;
GRANT ALL ON public.fdi_posture_snapshots TO service_role;
ALTER TABLE public.fdi_posture_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fdi_posture_snapshots_read"
  ON public.fdi_posture_snapshots FOR SELECT TO authenticated
  USING (public.has_country_access(auth.uid(), country_code));
CREATE POLICY "fdi_posture_snapshots_write"
  ON public.fdi_posture_snapshots FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

-- fdi_transition_theses
CREATE TABLE public.fdi_transition_theses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code TEXT NOT NULL,
  sector_code TEXT NOT NULL,
  thesis TEXT NOT NULL,
  angles JSONB NOT NULL DEFAULT '[]'::jsonb,
  investor_archetypes JSONB NOT NULL DEFAULT '[]'::jsonb,
  precedents JSONB NOT NULL DEFAULT '[]'::jsonb,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_code, sector_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fdi_transition_theses TO authenticated;
GRANT ALL ON public.fdi_transition_theses TO service_role;
ALTER TABLE public.fdi_transition_theses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fdi_transition_theses_read"
  ON public.fdi_transition_theses FOR SELECT TO authenticated
  USING (public.has_country_access(auth.uid(), country_code));
CREATE POLICY "fdi_transition_theses_write"
  ON public.fdi_transition_theses FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

-- fdi_playbooks
CREATE TABLE public.fdi_playbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code TEXT NOT NULL,
  strategy_id UUID REFERENCES public.fdi_strategies(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('macro','strategy','sector')),
  sector_code TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  ai_model TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX fdi_playbooks_country_idx ON public.fdi_playbooks (country_code, created_at DESC);
CREATE INDEX fdi_playbooks_strategy_idx ON public.fdi_playbooks (strategy_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fdi_playbooks TO authenticated;
GRANT ALL ON public.fdi_playbooks TO service_role;
ALTER TABLE public.fdi_playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fdi_playbooks_read"
  ON public.fdi_playbooks FOR SELECT TO authenticated
  USING (public.has_country_access(auth.uid(), country_code));
CREATE POLICY "fdi_playbooks_write"
  ON public.fdi_playbooks FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

-- fdi_playbook_actions
CREATE TABLE public.fdi_playbook_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playbook_id UUID NOT NULL REFERENCES public.fdi_playbooks(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  horizon TEXT NOT NULL CHECK (horizon IN ('30d','3m','6m','12m')),
  sector_code TEXT,
  ministry_id UUID REFERENCES public.ministries(id) ON DELETE SET NULL,
  ministry_slug TEXT,
  action TEXT NOT NULL,
  investor_signal TEXT,
  kpi_id UUID REFERENCES public.country_kpis(id) ON DELETE SET NULL,
  kpi_target TEXT,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','in_flight','done','blocked','dropped')),
  evidence_citation JSONB,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX fdi_playbook_actions_playbook_idx
  ON public.fdi_playbook_actions (playbook_id, horizon, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fdi_playbook_actions TO authenticated;
GRANT ALL ON public.fdi_playbook_actions TO service_role;
ALTER TABLE public.fdi_playbook_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fdi_playbook_actions_read"
  ON public.fdi_playbook_actions FOR SELECT TO authenticated
  USING (public.has_country_access(auth.uid(), country_code));
CREATE POLICY "fdi_playbook_actions_write"
  ON public.fdi_playbook_actions FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

-- updated_at triggers
CREATE TRIGGER fdi_posture_snapshots_touch BEFORE UPDATE ON public.fdi_posture_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER fdi_transition_theses_touch BEFORE UPDATE ON public.fdi_transition_theses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER fdi_playbooks_touch BEFORE UPDATE ON public.fdi_playbooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER fdi_playbook_actions_touch BEFORE UPDATE ON public.fdi_playbook_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
