
CREATE EXTENSION IF NOT EXISTS vector;

-- memory_objects
CREATE TABLE public.memory_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key TEXT NOT NULL,           -- country_code or 'REGIONAL'
  sector_code TEXT NOT NULL,
  kind TEXT NOT NULL,                -- audience|position|statement|outlet|precedent
  title TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  weight SMALLINT NOT NULL DEFAULT 3 CHECK (weight BETWEEN 1 AND 5),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  source_id UUID REFERENCES public.sources(id),
  embedding vector(1536),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.memory_objects (scope_key, sector_code, kind);
CREATE INDEX ON public.memory_objects USING hnsw (embedding vector_cosine_ops);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_objects TO authenticated;
GRANT ALL ON public.memory_objects TO service_role;
ALTER TABLE public.memory_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memory read bound or regional" ON public.memory_objects FOR SELECT TO authenticated
  USING (
    scope_key = 'REGIONAL'
    OR EXISTS (SELECT 1 FROM public.instance_bindings ib WHERE ib.user_id = auth.uid() AND ib.country_code = memory_objects.scope_key)
  );
CREATE POLICY "memory write steward" ON public.memory_objects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'data_steward') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'data_steward') OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER memory_updated BEFORE UPDATE ON public.memory_objects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- harvest_runs
CREATE TABLE public.harvest_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key TEXT NOT NULL,
  cadence_slot TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  failures JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX ON public.harvest_runs (scope_key, started_at DESC);
GRANT SELECT, INSERT ON public.harvest_runs TO authenticated;
GRANT ALL ON public.harvest_runs TO service_role;
ALTER TABLE public.harvest_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "harvest read bound or regional" ON public.harvest_runs FOR SELECT TO authenticated
  USING (
    scope_key = 'REGIONAL'
    OR EXISTS (SELECT 1 FROM public.instance_bindings ib WHERE ib.user_id = auth.uid() AND ib.country_code = harvest_runs.scope_key)
  );

-- intake_items
CREATE TABLE public.intake_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  harvest_run_id UUID REFERENCES public.harvest_runs(id) ON DELETE SET NULL,
  scope_key TEXT NOT NULL,
  sector_code TEXT NOT NULL,
  source_id UUID REFERENCES public.sources(id),
  topic TEXT NOT NULL,
  summary TEXT,
  url TEXT,
  proposed_weight SMALLINT NOT NULL DEFAULT 3 CHECK (proposed_weight BETWEEN 1 AND 5),
  final_weight SMALLINT CHECK (final_weight BETWEEN 1 AND 5),
  state TEXT NOT NULL DEFAULT 'pending',   -- pending|accepted|rejected|deferred
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.intake_items (scope_key, state, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.intake_items TO authenticated;
GRANT ALL ON public.intake_items TO service_role;
ALTER TABLE public.intake_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "intake read bound or regional" ON public.intake_items FOR SELECT TO authenticated
  USING (
    scope_key = 'REGIONAL'
    OR EXISTS (SELECT 1 FROM public.instance_bindings ib WHERE ib.user_id = auth.uid() AND ib.country_code = intake_items.scope_key)
  );
CREATE POLICY "intake write steward" ON public.intake_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'data_steward') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'data_steward') OR public.has_role(auth.uid(),'admin'));

-- curation_batches
CREATE TABLE public.curation_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key TEXT NOT NULL,
  curator_id UUID REFERENCES auth.users(id),
  committed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  item_count INTEGER NOT NULL DEFAULT 0,
  weight_distribution JSONB NOT NULL DEFAULT '{}'::jsonb
);
GRANT SELECT, INSERT ON public.curation_batches TO authenticated;
GRANT ALL ON public.curation_batches TO service_role;
ALTER TABLE public.curation_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "curation read bound or regional" ON public.curation_batches FOR SELECT TO authenticated
  USING (
    scope_key = 'REGIONAL'
    OR EXISTS (SELECT 1 FROM public.instance_bindings ib WHERE ib.user_id = auth.uid() AND ib.country_code = curation_batches.scope_key)
  );
CREATE POLICY "curation insert steward" ON public.curation_batches FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'data_steward') OR public.has_role(auth.uid(),'admin'));

-- research_briefs
CREATE TABLE public.research_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key TEXT NOT NULL,
  sector_hint TEXT,
  prompt TEXT NOT NULL,
  recency TEXT,
  results JSONB NOT NULL DEFAULT '[]'::jsonb,
  requested_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.research_briefs (scope_key, created_at DESC);
GRANT SELECT, INSERT ON public.research_briefs TO authenticated;
GRANT ALL ON public.research_briefs TO service_role;
ALTER TABLE public.research_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "briefs read bound or regional" ON public.research_briefs FOR SELECT TO authenticated
  USING (
    scope_key = 'REGIONAL'
    OR EXISTS (SELECT 1 FROM public.instance_bindings ib WHERE ib.user_id = auth.uid() AND ib.country_code = research_briefs.scope_key)
  );
CREATE POLICY "briefs insert self" ON public.research_briefs FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

-- source_suppressions
CREATE TABLE public.source_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  scope_key TEXT NOT NULL,
  reason TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  actor_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_id, scope_key)
);
GRANT SELECT, INSERT, UPDATE ON public.source_suppressions TO authenticated;
GRANT ALL ON public.source_suppressions TO service_role;
ALTER TABLE public.source_suppressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppress read bound or regional" ON public.source_suppressions FOR SELECT TO authenticated
  USING (
    scope_key = 'REGIONAL'
    OR EXISTS (SELECT 1 FROM public.instance_bindings ib WHERE ib.user_id = auth.uid() AND ib.country_code = source_suppressions.scope_key)
  );
CREATE POLICY "suppress write steward" ON public.source_suppressions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'data_steward') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'data_steward') OR public.has_role(auth.uid(),'admin'));

-- strategy_statements
CREATE TABLE public.strategy_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key TEXT NOT NULL,
  sector_code TEXT NOT NULL,
  title TEXT NOT NULL,
  seven_part JSONB NOT NULL DEFAULT '{}'::jsonb,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  approvals JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',   -- draft|review|approved|archived
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.strategy_statements (scope_key, sector_code);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_statements TO authenticated;
GRANT ALL ON public.strategy_statements TO service_role;
ALTER TABLE public.strategy_statements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "strategy read bound or regional" ON public.strategy_statements FOR SELECT TO authenticated
  USING (
    scope_key = 'REGIONAL'
    OR EXISTS (SELECT 1 FROM public.instance_bindings ib WHERE ib.user_id = auth.uid() AND ib.country_code = strategy_statements.scope_key)
  );
CREATE POLICY "strategy write advisor" ON public.strategy_statements FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'advisor')
    OR public.has_role(auth.uid(),'cabinet_secretary')
    OR public.has_role(auth.uid(),'admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'advisor')
    OR public.has_role(auth.uid(),'cabinet_secretary')
    OR public.has_role(auth.uid(),'admin')
  );
CREATE TRIGGER strategy_updated BEFORE UPDATE ON public.strategy_statements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- comms_artifacts
CREATE TABLE public.comms_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key TEXT NOT NULL,
  strategy_id UUID REFERENCES public.strategy_statements(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,            -- release|talking_points|social|op_ed|briefing
  audience TEXT NOT NULL,
  channel TEXT NOT NULL,
  body TEXT NOT NULL,
  draft_state TEXT NOT NULL DEFAULT 'draft',   -- draft|review|approved|released|withdrawn
  approvals JSONB NOT NULL DEFAULT '[]'::jsonb,
  released_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.comms_artifacts (scope_key, draft_state);
GRANT SELECT, INSERT, UPDATE ON public.comms_artifacts TO authenticated;
GRANT ALL ON public.comms_artifacts TO service_role;
ALTER TABLE public.comms_artifacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comms read bound or regional" ON public.comms_artifacts FOR SELECT TO authenticated
  USING (
    scope_key = 'REGIONAL'
    OR EXISTS (SELECT 1 FROM public.instance_bindings ib WHERE ib.user_id = auth.uid() AND ib.country_code = comms_artifacts.scope_key)
  );
CREATE POLICY "comms write comms role" ON public.comms_artifacts FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'comms_director')
    OR public.has_role(auth.uid(),'admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'comms_director')
    OR public.has_role(auth.uid(),'admin')
  );
CREATE TRIGGER comms_updated BEFORE UPDATE ON public.comms_artifacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- counsel_answers (append-only)
CREATE TABLE public.counsel_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  question TEXT NOT NULL,
  spoken_block TEXT,
  written_block TEXT,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  scenario_snapshot JSONB,
  content_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.counsel_answers (scope_key, created_at DESC);
CREATE INDEX ON public.counsel_answers (user_id, created_at DESC);
GRANT SELECT, INSERT ON public.counsel_answers TO authenticated;
GRANT ALL ON public.counsel_answers TO service_role;
ALTER TABLE public.counsel_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "counsel read self or cabsec" ON public.counsel_answers FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(),'cabinet_secretary')
    OR public.has_role(auth.uid(),'admin')
  );
CREATE POLICY "counsel insert self" ON public.counsel_answers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
