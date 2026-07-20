
-- persona_study_drafts
CREATE TABLE public.persona_study_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  title TEXT,
  step TEXT NOT NULL DEFAULT 'brief',
  visibility TEXT NOT NULL DEFAULT 'private',
  owner_country_code TEXT,
  brief_raw TEXT,
  brief_scope JSONB,
  outcome_raw TEXT,
  outcome_blueprint JSONB,
  cast_draft JSONB,
  uploads JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.persona_study_drafts TO authenticated;
GRANT ALL ON public.persona_study_drafts TO service_role;

ALTER TABLE public.persona_study_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study drafts: country access read"
  ON public.persona_study_drafts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));
CREATE POLICY "study drafts: country access write"
  ON public.persona_study_drafts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));
CREATE POLICY "study drafts: country access update"
  ON public.persona_study_drafts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));
CREATE POLICY "study drafts: country access delete"
  ON public.persona_study_drafts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));

CREATE TRIGGER persona_study_drafts_updated BEFORE UPDATE ON public.persona_study_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX persona_study_drafts_country_idx ON public.persona_study_drafts (country_code, updated_at DESC);

-- study_instruments
CREATE TABLE public.study_instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body JSONB NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public',
  owner_country_code TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_instruments TO authenticated;
GRANT ALL ON public.study_instruments TO service_role;

ALTER TABLE public.study_instruments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study instruments: read"
  ON public.study_instruments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));
CREATE POLICY "study instruments: write"
  ON public.study_instruments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));
CREATE POLICY "study instruments: update"
  ON public.study_instruments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));
CREATE POLICY "study instruments: delete"
  ON public.study_instruments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));

CREATE TRIGGER study_instruments_updated BEFORE UPDATE ON public.study_instruments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX study_instruments_study_idx ON public.study_instruments (study_id);

-- study_evidence
CREATE TABLE public.study_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id UUID REFERENCES public.studies(id) ON DELETE CASCADE,
  draft_id UUID REFERENCES public.persona_study_drafts(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  origin TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public',
  owner_country_code TEXT,
  title TEXT,
  url TEXT,
  snippet TEXT,
  source_id UUID,
  document_id UUID,
  chunk_id UUID,
  weight NUMERIC,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_evidence TO authenticated;
GRANT ALL ON public.study_evidence TO service_role;

ALTER TABLE public.study_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study evidence: read"
  ON public.study_evidence FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));
CREATE POLICY "study evidence: write"
  ON public.study_evidence FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));
CREATE POLICY "study evidence: update"
  ON public.study_evidence FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));
CREATE POLICY "study evidence: delete"
  ON public.study_evidence FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));

CREATE INDEX study_evidence_study_idx ON public.study_evidence (study_id);
CREATE INDEX study_evidence_draft_idx ON public.study_evidence (draft_id);

-- Storage RLS: country-scoped by first path segment (e.g. "ATG/<uuid>.pdf").
CREATE POLICY "study artifacts: country members read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'study-artifacts' AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), split_part(name, '/', 1))));
CREATE POLICY "study artifacts: country members write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'study-artifacts' AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), split_part(name, '/', 1))));
CREATE POLICY "study artifacts: country members delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'study-artifacts' AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), split_part(name, '/', 1))));
