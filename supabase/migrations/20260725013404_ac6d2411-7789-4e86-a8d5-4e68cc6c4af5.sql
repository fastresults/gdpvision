-- ============================================================================
-- Chamber 08 · Mandate Compact
-- ============================================================================

-- 1) mandate_compacts -----------------------------------------------------
CREATE TABLE public.mandate_compacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  manifesto_id uuid REFERENCES public.country_manifestos(id) ON DELETE SET NULL,
  governing_party_id uuid REFERENCES public.country_parties(id) ON DELETE SET NULL,
  election_cycle text NOT NULL,
  term_start date,
  term_end date,
  pm_name text,
  title text,
  summary text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','signed','in_force','concluded','superseded')),
  signed_at timestamptz,
  signed_by uuid REFERENCES auth.users(id),
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  owner_country_code text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, election_cycle)
);
CREATE INDEX mandate_compacts_country_idx ON public.mandate_compacts (country_code);
CREATE INDEX mandate_compacts_status_idx ON public.mandate_compacts (country_code, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mandate_compacts TO authenticated;
GRANT ALL ON public.mandate_compacts TO service_role;
GRANT SELECT ON public.mandate_compacts TO anon;

ALTER TABLE public.mandate_compacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mandate_compacts_read_scoped" ON public.mandate_compacts
  FOR SELECT TO authenticated
  USING (visibility = 'public' OR public.has_country_access(auth.uid(), country_code));

CREATE POLICY "mandate_compacts_read_public_anon" ON public.mandate_compacts
  FOR SELECT TO anon
  USING (visibility = 'public' AND status IN ('signed','in_force','concluded'));

CREATE POLICY "mandate_compacts_admin_all" ON public.mandate_compacts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));

CREATE TRIGGER mandate_compacts_updated_at BEFORE UPDATE ON public.mandate_compacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER mandate_compacts_private_ownership BEFORE INSERT OR UPDATE ON public.mandate_compacts
  FOR EACH ROW EXECUTE FUNCTION public.enforce_private_ownership();


-- 2) compact_pillars ------------------------------------------------------
CREATE TABLE public.compact_pillars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compact_id uuid NOT NULL REFERENCES public.mandate_compacts(id) ON DELETE CASCADE,
  country_code text NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  title text NOT NULL,
  narrative text,
  color_token text,
  sort_order integer NOT NULL DEFAULT 100,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  owner_country_code text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX compact_pillars_compact_idx ON public.compact_pillars (compact_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compact_pillars TO authenticated;
GRANT ALL ON public.compact_pillars TO service_role;
GRANT SELECT ON public.compact_pillars TO anon;

ALTER TABLE public.compact_pillars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compact_pillars_read_scoped" ON public.compact_pillars
  FOR SELECT TO authenticated
  USING (visibility = 'public' OR public.has_country_access(auth.uid(), country_code));

CREATE POLICY "compact_pillars_read_public_anon" ON public.compact_pillars
  FOR SELECT TO anon
  USING (visibility = 'public' AND EXISTS (
    SELECT 1 FROM public.mandate_compacts c
    WHERE c.id = compact_pillars.compact_id
      AND c.visibility = 'public'
      AND c.status IN ('signed','in_force','concluded')
  ));

CREATE POLICY "compact_pillars_admin_all" ON public.compact_pillars
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));

CREATE TRIGGER compact_pillars_updated_at BEFORE UPDATE ON public.compact_pillars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER compact_pillars_private_ownership BEFORE INSERT OR UPDATE ON public.compact_pillars
  FOR EACH ROW EXECUTE FUNCTION public.enforce_private_ownership();


-- 3) compact_pledges ------------------------------------------------------
CREATE TABLE public.compact_pledges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pillar_id uuid NOT NULL REFERENCES public.compact_pillars(id) ON DELETE CASCADE,
  compact_id uuid NOT NULL REFERENCES public.mandate_compacts(id) ON DELETE CASCADE,
  country_code text NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  title text NOT NULL,
  verbatim_quote text,
  page_ref text,
  pledge_type text CHECK (pledge_type IN ('quantitative','qualitative','legislative','institutional')),
  baseline_value numeric,
  target_value numeric,
  unit text,
  sort_order integer NOT NULL DEFAULT 100,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  memory_object_id uuid REFERENCES public.memory_objects(id) ON DELETE SET NULL,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  owner_country_code text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX compact_pledges_pillar_idx ON public.compact_pledges (pillar_id, sort_order);
CREATE INDEX compact_pledges_compact_idx ON public.compact_pledges (compact_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compact_pledges TO authenticated;
GRANT ALL ON public.compact_pledges TO service_role;
GRANT SELECT ON public.compact_pledges TO anon;

ALTER TABLE public.compact_pledges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compact_pledges_read_scoped" ON public.compact_pledges
  FOR SELECT TO authenticated
  USING (visibility = 'public' OR public.has_country_access(auth.uid(), country_code));

CREATE POLICY "compact_pledges_read_public_anon" ON public.compact_pledges
  FOR SELECT TO anon
  USING (visibility = 'public' AND EXISTS (
    SELECT 1 FROM public.mandate_compacts c
    WHERE c.id = compact_pledges.compact_id
      AND c.visibility = 'public'
      AND c.status IN ('signed','in_force','concluded')
  ));

CREATE POLICY "compact_pledges_admin_all" ON public.compact_pledges
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));

CREATE TRIGGER compact_pledges_updated_at BEFORE UPDATE ON public.compact_pledges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER compact_pledges_private_ownership BEFORE INSERT OR UPDATE ON public.compact_pledges
  FOR EACH ROW EXECUTE FUNCTION public.enforce_private_ownership();


-- 4) compact_deliverables -------------------------------------------------
CREATE TABLE public.compact_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pledge_id uuid NOT NULL REFERENCES public.compact_pledges(id) ON DELETE CASCADE,
  compact_id uuid NOT NULL REFERENCES public.mandate_compacts(id) ON DELETE CASCADE,
  country_code text NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  lead_ministry_id uuid REFERENCES public.ministries(id) ON DELETE SET NULL,
  supporting_ministry_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  title text NOT NULL,
  theory_of_change text,
  quarterly_milestones jsonb NOT NULL DEFAULT '[]'::jsonb,
  budget_envelope numeric,
  budget_currency text,
  dependencies uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  risk_level text CHECK (risk_level IN ('low','medium','high','critical')),
  kpi_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  transformational_note text,
  signed_off_at timestamptz,
  signed_off_by uuid REFERENCES auth.users(id),
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  memory_object_id uuid REFERENCES public.memory_objects(id) ON DELETE SET NULL,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  owner_country_code text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX compact_deliverables_pledge_idx ON public.compact_deliverables (pledge_id);
CREATE INDEX compact_deliverables_compact_idx ON public.compact_deliverables (compact_id);
CREATE INDEX compact_deliverables_ministry_idx ON public.compact_deliverables (lead_ministry_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compact_deliverables TO authenticated;
GRANT ALL ON public.compact_deliverables TO service_role;

ALTER TABLE public.compact_deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compact_deliverables_read_scoped" ON public.compact_deliverables
  FOR SELECT TO authenticated
  USING (visibility = 'public' OR public.has_country_access(auth.uid(), country_code));

CREATE POLICY "compact_deliverables_admin_all" ON public.compact_deliverables
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));

CREATE TRIGGER compact_deliverables_updated_at BEFORE UPDATE ON public.compact_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER compact_deliverables_private_ownership BEFORE INSERT OR UPDATE ON public.compact_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.enforce_private_ownership();


-- 5) compact_status_updates ----------------------------------------------
CREATE TABLE public.compact_status_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id uuid NOT NULL REFERENCES public.compact_deliverables(id) ON DELETE CASCADE,
  compact_id uuid NOT NULL REFERENCES public.mandate_compacts(id) ON DELETE CASCADE,
  country_code text NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  ministry_id uuid REFERENCES public.ministries(id) ON DELETE SET NULL,
  reported_by uuid REFERENCES auth.users(id),
  period text NOT NULL,
  status text NOT NULL CHECK (status IN ('on_track','at_risk','off_track','delivered','broken')),
  evidence_url text,
  narrative text,
  kpi_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  memory_object_id uuid REFERENCES public.memory_objects(id) ON DELETE SET NULL,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  owner_country_code text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX compact_status_updates_deliverable_idx ON public.compact_status_updates (deliverable_id, period);
CREATE INDEX compact_status_updates_compact_period_idx ON public.compact_status_updates (compact_id, period);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compact_status_updates TO authenticated;
GRANT ALL ON public.compact_status_updates TO service_role;

ALTER TABLE public.compact_status_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compact_status_updates_read_scoped" ON public.compact_status_updates
  FOR SELECT TO authenticated
  USING (visibility = 'public' OR public.has_country_access(auth.uid(), country_code));

CREATE POLICY "compact_status_updates_write" ON public.compact_status_updates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));

CREATE TRIGGER compact_status_updates_private_ownership BEFORE INSERT OR UPDATE ON public.compact_status_updates
  FOR EACH ROW EXECUTE FUNCTION public.enforce_private_ownership();


-- 6) compact_scorecards --------------------------------------------------
CREATE TABLE public.compact_scorecards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compact_id uuid NOT NULL REFERENCES public.mandate_compacts(id) ON DELETE CASCADE,
  country_code text NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  ministry_id uuid REFERENCES public.ministries(id) ON DELETE SET NULL,
  period text NOT NULL,
  on_track_pct numeric NOT NULL DEFAULT 0,
  at_risk_pct numeric NOT NULL DEFAULT 0,
  off_track_pct numeric NOT NULL DEFAULT 0,
  delivered_pct numeric NOT NULL DEFAULT 0,
  broken_pct numeric NOT NULL DEFAULT 0,
  weighted_progress numeric NOT NULL DEFAULT 0,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  owner_country_code text,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (compact_id, ministry_id, period)
);
CREATE INDEX compact_scorecards_country_period_idx ON public.compact_scorecards (country_code, period);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compact_scorecards TO authenticated;
GRANT ALL ON public.compact_scorecards TO service_role;
GRANT SELECT ON public.compact_scorecards TO anon;

ALTER TABLE public.compact_scorecards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compact_scorecards_read_scoped" ON public.compact_scorecards
  FOR SELECT TO authenticated
  USING (visibility = 'public' OR public.has_country_access(auth.uid(), country_code));

CREATE POLICY "compact_scorecards_read_public_anon" ON public.compact_scorecards
  FOR SELECT TO anon
  USING (visibility = 'public' AND EXISTS (
    SELECT 1 FROM public.mandate_compacts c
    WHERE c.id = compact_scorecards.compact_id
      AND c.visibility = 'public'
      AND c.status IN ('signed','in_force','concluded')
  ));

CREATE POLICY "compact_scorecards_write" ON public.compact_scorecards
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));


-- 7) compact_revisions ---------------------------------------------------
CREATE TABLE public.compact_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compact_id uuid NOT NULL REFERENCES public.mandate_compacts(id) ON DELETE CASCADE,
  country_code text NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  revision_number integer NOT NULL,
  reason text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  editor_id uuid REFERENCES auth.users(id),
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  owner_country_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (compact_id, revision_number)
);

GRANT SELECT, INSERT ON public.compact_revisions TO authenticated;
GRANT ALL ON public.compact_revisions TO service_role;
GRANT SELECT ON public.compact_revisions TO anon;

ALTER TABLE public.compact_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compact_revisions_read_scoped" ON public.compact_revisions
  FOR SELECT TO authenticated
  USING (visibility = 'public' OR public.has_country_access(auth.uid(), country_code));

CREATE POLICY "compact_revisions_read_public_anon" ON public.compact_revisions
  FOR SELECT TO anon
  USING (visibility = 'public' AND EXISTS (
    SELECT 1 FROM public.mandate_compacts c
    WHERE c.id = compact_revisions.compact_id
      AND c.visibility = 'public'
      AND c.status IN ('signed','in_force','concluded')
  ));

CREATE POLICY "compact_revisions_write" ON public.compact_revisions
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));
