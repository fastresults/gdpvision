
-- Chamber 07 · Synthetic Persona Lab

-- ── personas ──────────────────────────────────────────────────────────
CREATE TABLE public.personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  name text NOT NULL,
  archetype text,
  summary text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ocean jsonb NOT NULL DEFAULT '{}'::jsonb,
  grounding_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  origin text NOT NULL DEFAULT 'ai' CHECK (origin IN ('ai','manual')),
  version int NOT NULL DEFAULT 1,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  owner_user_id uuid,
  owner_country_code text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX personas_country_idx ON public.personas(country_code);
CREATE INDEX personas_owner_idx ON public.personas(owner_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personas TO authenticated;
GRANT ALL ON public.personas TO service_role;
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personas read" ON public.personas FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (visibility = 'public' AND public.has_country_access(auth.uid(), country_code))
  OR (visibility = 'private' AND owner_user_id = auth.uid())
);
CREATE POLICY "personas insert" ON public.personas FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code)
);
CREATE POLICY "personas update" ON public.personas FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid()
);
CREATE POLICY "personas delete" ON public.personas FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid()
);

CREATE TRIGGER personas_updated_at BEFORE UPDATE ON public.personas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── persona_segments ──────────────────────────────────────────────────
CREATE TABLE public.persona_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  label text NOT NULL,
  prompt text NOT NULL,
  distribution jsonb NOT NULL DEFAULT '{}'::jsonb,
  size int NOT NULL DEFAULT 0,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  owner_user_id uuid,
  owner_country_code text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX persona_segments_country_idx ON public.persona_segments(country_code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.persona_segments TO authenticated;
GRANT ALL ON public.persona_segments TO service_role;
ALTER TABLE public.persona_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "segments read" ON public.persona_segments FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (visibility = 'public' AND public.has_country_access(auth.uid(), country_code))
  OR (visibility = 'private' AND owner_user_id = auth.uid())
);
CREATE POLICY "segments insert" ON public.persona_segments FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code)
);
CREATE POLICY "segments update" ON public.persona_segments FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid()
);
CREATE POLICY "segments delete" ON public.persona_segments FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid()
);

CREATE TRIGGER persona_segments_updated_at BEFORE UPDATE ON public.persona_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── persona_segment_members ───────────────────────────────────────────
CREATE TABLE public.persona_segment_members (
  segment_id uuid NOT NULL REFERENCES public.persona_segments(id) ON DELETE CASCADE,
  persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  PRIMARY KEY (segment_id, persona_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.persona_segment_members TO authenticated;
GRANT ALL ON public.persona_segment_members TO service_role;
ALTER TABLE public.persona_segment_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "segment_members read" ON public.persona_segment_members FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.persona_segments s WHERE s.id = segment_id)
);
CREATE POLICY "segment_members write" ON public.persona_segment_members FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.persona_segments s WHERE s.id = segment_id
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR s.owner_user_id = auth.uid()
      OR public.has_country_access(auth.uid(), s.country_code)))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.persona_segments s WHERE s.id = segment_id
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR s.owner_user_id = auth.uid()
      OR public.has_country_access(auth.uid(), s.country_code)))
);

-- ── studies ───────────────────────────────────────────────────────────
CREATE TABLE public.studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('survey','focus_group','creative','interview','analyze')),
  title text NOT NULL,
  objective text,
  segment_id uuid REFERENCES public.persona_segments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','running','completed','failed')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  owner_user_id uuid,
  owner_country_code text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX studies_country_idx ON public.studies(country_code);
CREATE INDEX studies_status_idx ON public.studies(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.studies TO authenticated;
GRANT ALL ON public.studies TO service_role;
ALTER TABLE public.studies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "studies read" ON public.studies FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (visibility = 'public' AND public.has_country_access(auth.uid(), country_code))
  OR (visibility = 'private' AND owner_user_id = auth.uid())
);
CREATE POLICY "studies insert" ON public.studies FOR INSERT TO authenticated WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code)
);
CREATE POLICY "studies update" ON public.studies FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid()
);
CREATE POLICY "studies delete" ON public.studies FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(), 'admin'::public.app_role) OR owner_user_id = auth.uid()
);

CREATE TRIGGER studies_updated_at BEFORE UPDATE ON public.studies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── study_questions ───────────────────────────────────────────────────
CREATE TABLE public.study_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  ord int NOT NULL,
  kind text NOT NULL,
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX study_questions_study_idx ON public.study_questions(study_id, ord);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_questions TO authenticated;
GRANT ALL ON public.study_questions TO service_role;
ALTER TABLE public.study_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_questions rw" ON public.study_questions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.studies s WHERE s.id = study_id
    AND (public.has_role(auth.uid(), 'admin'::public.app_role)
      OR (s.visibility = 'public' AND public.has_country_access(auth.uid(), s.country_code))
      OR (s.visibility = 'private' AND s.owner_user_id = auth.uid())))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.studies s WHERE s.id = study_id
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR s.owner_user_id = auth.uid()
      OR public.has_country_access(auth.uid(), s.country_code)))
);

-- ── study_responses ───────────────────────────────────────────────────
CREATE TABLE public.study_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.study_questions(id) ON DELETE CASCADE,
  persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  answer jsonb NOT NULL DEFAULT '{}'::jsonb,
  rationale text,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX study_responses_study_idx ON public.study_responses(study_id);
CREATE INDEX study_responses_persona_idx ON public.study_responses(persona_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_responses TO authenticated;
GRANT ALL ON public.study_responses TO service_role;
ALTER TABLE public.study_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_responses rw" ON public.study_responses FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.studies s WHERE s.id = study_id
    AND (public.has_role(auth.uid(), 'admin'::public.app_role)
      OR (s.visibility = 'public' AND public.has_country_access(auth.uid(), s.country_code))
      OR (s.visibility = 'private' AND s.owner_user_id = auth.uid())))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.studies s WHERE s.id = study_id
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR s.owner_user_id = auth.uid()
      OR public.has_country_access(auth.uid(), s.country_code)))
);

-- ── study_transcripts ─────────────────────────────────────────────────
CREATE TABLE public.study_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  ord int NOT NULL,
  persona_id uuid REFERENCES public.personas(id) ON DELETE SET NULL,
  speaker text NOT NULL,
  utterance text NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX study_transcripts_study_idx ON public.study_transcripts(study_id, ord);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_transcripts TO authenticated;
GRANT ALL ON public.study_transcripts TO service_role;
ALTER TABLE public.study_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_transcripts rw" ON public.study_transcripts FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.studies s WHERE s.id = study_id
    AND (public.has_role(auth.uid(), 'admin'::public.app_role)
      OR (s.visibility = 'public' AND public.has_country_access(auth.uid(), s.country_code))
      OR (s.visibility = 'private' AND s.owner_user_id = auth.uid())))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.studies s WHERE s.id = study_id
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR s.owner_user_id = auth.uid()
      OR public.has_country_access(auth.uid(), s.country_code)))
);

-- ── study_reports ─────────────────────────────────────────────────────
CREATE TABLE public.study_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id uuid NOT NULL UNIQUE REFERENCES public.studies(id) ON DELETE CASCADE,
  summary_md text NOT NULL DEFAULT '',
  themes jsonb NOT NULL DEFAULT '[]'::jsonb,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_reports TO authenticated;
GRANT ALL ON public.study_reports TO service_role;
ALTER TABLE public.study_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_reports rw" ON public.study_reports FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.studies s WHERE s.id = study_id
    AND (public.has_role(auth.uid(), 'admin'::public.app_role)
      OR (s.visibility = 'public' AND public.has_country_access(auth.uid(), s.country_code))
      OR (s.visibility = 'private' AND s.owner_user_id = auth.uid())))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.studies s WHERE s.id = study_id
    AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR s.owner_user_id = auth.uid()
      OR public.has_country_access(auth.uid(), s.country_code)))
);

CREATE TRIGGER study_reports_updated_at BEFORE UPDATE ON public.study_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── persona_chats ─────────────────────────────────────────────────────
CREATE TABLE public.persona_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  user_id uuid NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX persona_chats_persona_idx ON public.persona_chats(persona_id);
CREATE INDEX persona_chats_user_idx ON public.persona_chats(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.persona_chats TO authenticated;
GRANT ALL ON public.persona_chats TO service_role;
ALTER TABLE public.persona_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "persona_chats rw" ON public.persona_chats FOR ALL TO authenticated USING (
  user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)
) WITH CHECK (
  user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE TRIGGER persona_chats_updated_at BEFORE UPDATE ON public.persona_chats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── persona_chat_messages ─────────────────────────────────────────────
CREATE TABLE public.persona_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.persona_chats(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system')),
  content text NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX persona_chat_messages_chat_idx ON public.persona_chat_messages(chat_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.persona_chat_messages TO authenticated;
GRANT ALL ON public.persona_chat_messages TO service_role;
ALTER TABLE public.persona_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "persona_chat_messages rw" ON public.persona_chat_messages FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.persona_chats c WHERE c.id = chat_id
    AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.persona_chats c WHERE c.id = chat_id
    AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role)))
);
