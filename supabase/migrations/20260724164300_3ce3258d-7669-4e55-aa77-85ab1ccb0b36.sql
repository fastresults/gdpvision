-- ============================================================
-- country_parties
-- ============================================================
CREATE TABLE public.country_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  name text NOT NULL,
  abbreviation text,
  leader_name text,
  leader_role text,
  ideology text,
  founded_year int,
  seats_current int,
  seats_total int,
  vote_share_pct numeric,
  is_ruling boolean NOT NULL DEFAULT false,
  coalition_role text CHECK (coalition_role IS NULL OR coalition_role IN ('lead','partner','opposition','minor')),
  last_election_date date,
  source_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence_grade char(1) DEFAULT 'C',
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  owner_country_code text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX country_parties_name_uidx
  ON public.country_parties (country_code, lower(name));

CREATE UNIQUE INDEX country_parties_lead_ruling_uidx
  ON public.country_parties (country_code)
  WHERE is_ruling AND coalition_role = 'lead';

CREATE INDEX country_parties_country_idx ON public.country_parties (country_code);

GRANT SELECT ON public.country_parties TO authenticated;
GRANT ALL ON public.country_parties TO service_role;

ALTER TABLE public.country_parties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parties_admin_all"
  ON public.country_parties FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "parties_read_scoped"
  ON public.country_parties FOR SELECT TO authenticated
  USING (
    visibility = 'public'
    OR public.has_country_access(auth.uid(), country_code)
  );

CREATE TRIGGER country_parties_updated_at
  BEFORE UPDATE ON public.country_parties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER country_parties_private_ownership
  BEFORE INSERT OR UPDATE ON public.country_parties
  FOR EACH ROW EXECUTE FUNCTION public.enforce_private_ownership();

-- ============================================================
-- country_manifestos
-- ============================================================
CREATE TABLE public.country_manifestos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  party_id uuid NOT NULL REFERENCES public.country_parties(id) ON DELETE CASCADE,
  election_cycle text NOT NULL,
  title text,
  summary text,
  themes jsonb NOT NULL DEFAULT '[]'::jsonb,
  pledges jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_url text,
  source_document_id uuid REFERENCES public.country_source_documents(id) ON DELETE SET NULL,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence_grade char(1) DEFAULT 'C',
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  owner_country_code text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX country_manifestos_uidx
  ON public.country_manifestos (country_code, party_id, election_cycle);

CREATE INDEX country_manifestos_country_idx ON public.country_manifestos (country_code);

GRANT SELECT ON public.country_manifestos TO authenticated;
GRANT ALL ON public.country_manifestos TO service_role;

ALTER TABLE public.country_manifestos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manifestos_admin_all"
  ON public.country_manifestos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "manifestos_read_scoped"
  ON public.country_manifestos FOR SELECT TO authenticated
  USING (
    visibility = 'public'
    OR public.has_country_access(auth.uid(), country_code)
  );

CREATE TRIGGER country_manifestos_updated_at
  BEFORE UPDATE ON public.country_manifestos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER country_manifestos_private_ownership
  BEFORE INSERT OR UPDATE ON public.country_manifestos
  FOR EACH ROW EXECUTE FUNCTION public.enforce_private_ownership();

-- ============================================================
-- party_backfill_runs
-- ============================================================
CREATE TABLE public.party_backfill_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  requested_by uuid,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  heartbeat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.party_backfill_runs TO authenticated;
GRANT ALL ON public.party_backfill_runs TO service_role;

ALTER TABLE public.party_backfill_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "party_backfill_runs_admin_all"
  ON public.party_backfill_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ============================================================
-- party_backfill_country_runs
-- ============================================================
CREATE TABLE public.party_backfill_country_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.party_backfill_runs(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  attempted int NOT NULL DEFAULT 0,
  parties_upserted int NOT NULL DEFAULT 0,
  ruling_flagged boolean NOT NULL DEFAULT false,
  manifesto_ingested boolean NOT NULL DEFAULT false,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX party_backfill_country_runs_run_idx
  ON public.party_backfill_country_runs (run_id);

GRANT SELECT ON public.party_backfill_country_runs TO authenticated;
GRANT ALL ON public.party_backfill_country_runs TO service_role;

ALTER TABLE public.party_backfill_country_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "party_backfill_country_runs_admin_all"
  ON public.party_backfill_country_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
