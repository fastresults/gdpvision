
-- packages
CREATE TABLE public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  sector_code TEXT NOT NULL,
  name TEXT NOT NULL,
  summary TEXT,
  gates JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabling_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_gap_pct NUMERIC,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.packages (country_code, sector_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packages TO authenticated;
GRANT ALL ON public.packages TO service_role;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "packages read bound" ON public.packages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.instance_bindings ib WHERE ib.user_id = auth.uid() AND ib.country_code = packages.country_code));
CREATE POLICY "packages write cabsec" ON public.packages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'cabinet_secretary') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'cabinet_secretary') OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER packages_updated BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- kpis
CREATE TABLE public.kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  sector_code TEXT NOT NULL,
  ministry_id UUID REFERENCES public.ministries(id) ON DELETE SET NULL,
  metric TEXT NOT NULL,
  unit TEXT NOT NULL,
  baseline NUMERIC,
  target NUMERIC NOT NULL,
  target_period TEXT,
  classification TEXT NOT NULL DEFAULT 'internal',
  cadence TEXT NOT NULL DEFAULT 'quarterly',
  owner_id UUID REFERENCES auth.users(id),
  plan_scenario_id UUID REFERENCES public.scenarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.kpis (country_code, sector_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kpis TO authenticated;
GRANT ALL ON public.kpis TO service_role;
ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kpis read bound" ON public.kpis FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.instance_bindings ib WHERE ib.user_id = auth.uid() AND ib.country_code = kpis.country_code));
CREATE POLICY "kpis write cabsec" ON public.kpis FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'cabinet_secretary') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'cabinet_secretary') OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER kpis_updated BEFORE UPDATE ON public.kpis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- goal_cycles
CREATE TABLE public.goal_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID NOT NULL REFERENCES public.kpis(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'on_track',
  figures JSONB NOT NULL DEFAULT '{}'::jsonb,
  commentary TEXT,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (kpi_id, period)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_cycles TO authenticated;
GRANT ALL ON public.goal_cycles TO service_role;
ALTER TABLE public.goal_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goal_cycles read bound" ON public.goal_cycles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.kpis k JOIN public.instance_bindings ib ON ib.country_code = k.country_code
    WHERE k.id = goal_cycles.kpi_id AND ib.user_id = auth.uid()
  ));
CREATE POLICY "goal_cycles write owner or cabsec" ON public.goal_cycles FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'cabinet_secretary') OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.kpis k WHERE k.id = goal_cycles.kpi_id AND k.owner_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(),'cabinet_secretary') OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.kpis k WHERE k.id = goal_cycles.kpi_id AND k.owner_id = auth.uid())
  );
CREATE TRIGGER goal_cycles_updated BEFORE UPDATE ON public.goal_cycles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- mandates
CREATE TABLE public.mandates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  kpi_id UUID REFERENCES public.kpis(id) ON DELETE CASCADE,
  scenario_id UUID REFERENCES public.scenarios(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.packages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
  cadence TEXT NOT NULL DEFAULT 'quarterly',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((kpi_id IS NOT NULL)::int + (scenario_id IS NOT NULL)::int + (package_id IS NOT NULL)::int >= 1)
);
CREATE INDEX ON public.mandates (country_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mandates TO authenticated;
GRANT ALL ON public.mandates TO service_role;
ALTER TABLE public.mandates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mandates read bound" ON public.mandates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.instance_bindings ib WHERE ib.user_id = auth.uid() AND ib.country_code = mandates.country_code));
CREATE POLICY "mandates write cabsec" ON public.mandates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'cabinet_secretary') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'cabinet_secretary') OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER mandates_updated BEFORE UPDATE ON public.mandates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- cabinet_sessions
CREATE TABLE public.cabinet_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  title TEXT NOT NULL,
  agenda JSONB NOT NULL DEFAULT '[]'::jsonb,
  minutes TEXT,
  classification TEXT NOT NULL DEFAULT 'restricted',
  scheduled_for TIMESTAMPTZ,
  held_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.cabinet_sessions (country_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cabinet_sessions TO authenticated;
GRANT ALL ON public.cabinet_sessions TO service_role;
ALTER TABLE public.cabinet_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions read bound" ON public.cabinet_sessions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.instance_bindings ib WHERE ib.user_id = auth.uid() AND ib.country_code = cabinet_sessions.country_code));
CREATE POLICY "sessions write cabsec" ON public.cabinet_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'cabinet_secretary') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'cabinet_secretary') OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER sessions_updated BEFORE UPDATE ON public.cabinet_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- decisions (append-only)
CREATE TABLE public.decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.cabinet_sessions(id) ON DELETE RESTRICT,
  country_code TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  mandate_id UUID REFERENCES public.mandates(id),
  recorded_by UUID REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.decisions (session_id);
GRANT SELECT, INSERT ON public.decisions TO authenticated;
GRANT ALL ON public.decisions TO service_role;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "decisions read bound" ON public.decisions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.instance_bindings ib WHERE ib.user_id = auth.uid() AND ib.country_code = decisions.country_code));
CREATE POLICY "decisions insert cabsec" ON public.decisions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'cabinet_secretary') OR public.has_role(auth.uid(),'admin'));

-- commitments (append-only)
CREATE TABLE public.commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES public.decisions(id) ON DELETE RESTRICT,
  country_code TEXT NOT NULL,
  title TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id),
  ministry_id UUID REFERENCES public.ministries(id),
  due_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'open',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.commitments (country_code, status);
GRANT SELECT, INSERT, UPDATE ON public.commitments TO authenticated;
GRANT ALL ON public.commitments TO service_role;
ALTER TABLE public.commitments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commitments read bound" ON public.commitments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.instance_bindings ib WHERE ib.user_id = auth.uid() AND ib.country_code = commitments.country_code));
CREATE POLICY "commitments insert cabsec" ON public.commitments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'cabinet_secretary') OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "commitments status update by owner or cabsec" ON public.commitments FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.has_role(auth.uid(),'cabinet_secretary')
    OR public.has_role(auth.uid(),'admin')
  );

-- exports_log (append-only)
CREATE TABLE public.exports_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  artifact_kind TEXT NOT NULL,
  artifact_ref TEXT,
  classification TEXT NOT NULL DEFAULT 'restricted',
  watermark TEXT NOT NULL,
  exported_by UUID REFERENCES auth.users(id),
  exported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.exports_log (country_code, exported_at DESC);
GRANT SELECT, INSERT ON public.exports_log TO authenticated;
GRANT ALL ON public.exports_log TO service_role;
ALTER TABLE public.exports_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exports read bound" ON public.exports_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.instance_bindings ib WHERE ib.user_id = auth.uid() AND ib.country_code = exports_log.country_code));
CREATE POLICY "exports insert self" ON public.exports_log FOR INSERT TO authenticated
  WITH CHECK (exported_by = auth.uid());
