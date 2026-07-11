
-- Ministries (portfolios per country)
CREATE TABLE public.ministries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_code, slug)
);
GRANT SELECT ON public.ministries TO authenticated;
GRANT ALL ON public.ministries TO service_role;
ALTER TABLE public.ministries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ministries readable by authenticated" ON public.ministries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ministries writable by steward/admin" ON public.ministries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'data_steward') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'data_steward') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_ministries_updated_at BEFORE UPDATE ON public.ministries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ministry ↔ sector mapping
CREATE TABLE public.ministry_sectors (
  ministry_id UUID NOT NULL REFERENCES public.ministries(id) ON DELETE CASCADE,
  sector_code TEXT NOT NULL REFERENCES public.sectors(code) ON DELETE CASCADE,
  weight NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ministry_id, sector_code)
);
GRANT SELECT ON public.ministry_sectors TO authenticated;
GRANT ALL ON public.ministry_sectors TO service_role;
ALTER TABLE public.ministry_sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ministry_sectors readable by authenticated" ON public.ministry_sectors
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ministry_sectors writable by steward/admin" ON public.ministry_sectors
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'data_steward') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'data_steward') OR public.has_role(auth.uid(), 'admin'));

-- Levers
CREATE TABLE public.levers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  sector_code TEXT NOT NULL REFERENCES public.sectors(code) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  bounds JSONB NOT NULL DEFAULT '{"min":0,"max":100,"step":1}'::jsonb,
  response_fn_ref TEXT NOT NULL DEFAULT 'v1_macro.default',
  methodology_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (country_code, slug)
);
GRANT SELECT ON public.levers TO authenticated;
GRANT ALL ON public.levers TO service_role;
ALTER TABLE public.levers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "levers readable by authenticated" ON public.levers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "levers writable by steward/admin" ON public.levers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'data_steward') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'data_steward') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_levers_updated_at BEFORE UPDATE ON public.levers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Scenario lifecycle
CREATE TYPE public.scenario_status AS ENUM ('draft', 'shared', 'adopted', 'archived');

-- Scenarios
CREATE TABLE public.scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  sector_code TEXT REFERENCES public.sectors(code) ON DELETE SET NULL,
  ministry_id UUID REFERENCES public.ministries(id) ON DELETE SET NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  horizon_years INT NOT NULL DEFAULT 5,
  model_version TEXT NOT NULL DEFAULT 'v1_macro',
  status public.scenario_status NOT NULL DEFAULT 'draft',
  lever_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  assumptions JSONB NOT NULL DEFAULT '{}'::jsonb,
  results JSONB NOT NULL DEFAULT '{}'::jsonb,
  attribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_scenarios_country ON public.scenarios(country_code, status);
CREATE INDEX idx_scenarios_author ON public.scenarios(author_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scenarios TO authenticated;
GRANT ALL ON public.scenarios TO service_role;
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;

-- Read: author, admin, or (non-draft AND shares a binding on same country)
CREATE POLICY "scenarios readable by author or bound peers" ON public.scenarios
  FOR SELECT TO authenticated
  USING (
    author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR (
      status <> 'draft'
      AND EXISTS (
        SELECT 1 FROM public.instance_bindings ib
        WHERE ib.user_id = auth.uid() AND ib.country_code = scenarios.country_code
      )
    )
  );

-- Insert: any authenticated user who has a binding for that country
CREATE POLICY "scenarios insertable by bound authors" ON public.scenarios
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.instance_bindings ib
        WHERE ib.user_id = auth.uid() AND ib.country_code = scenarios.country_code
      )
    )
  );

-- Update: authors on their own drafts; admins and cabinet_secretary always
CREATE POLICY "scenarios updatable by author or officers" ON public.scenarios
  FOR UPDATE TO authenticated
  USING (
    (author_id = auth.uid() AND status = 'draft')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'cabinet_secretary')
  )
  WITH CHECK (
    (author_id = auth.uid() AND status IN ('draft','shared','archived'))
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'cabinet_secretary')
  );

CREATE POLICY "scenarios deletable by author draft or admin" ON public.scenarios
  FOR DELETE TO authenticated
  USING (
    (author_id = auth.uid() AND status = 'draft')
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER trg_scenarios_updated_at BEFORE UPDATE ON public.scenarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Scenario promotions (audit)
CREATE TABLE public.scenario_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  from_status public.scenario_status NOT NULL,
  to_status public.scenario_status NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_scenario_promotions_scenario ON public.scenario_promotions(scenario_id, created_at DESC);
GRANT SELECT, INSERT ON public.scenario_promotions TO authenticated;
GRANT ALL ON public.scenario_promotions TO service_role;
ALTER TABLE public.scenario_promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promotions readable when scenario readable" ON public.scenario_promotions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scenarios s WHERE s.id = scenario_id));
CREATE POLICY "promotions insertable by cabinet_secretary/admin" ON public.scenario_promotions
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (public.has_role(auth.uid(), 'cabinet_secretary') OR public.has_role(auth.uid(), 'admin'))
  );
