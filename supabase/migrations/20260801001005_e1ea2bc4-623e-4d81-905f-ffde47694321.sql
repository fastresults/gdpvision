
-- ── Programme plan ────────────────────────────────────────────────────────
CREATE TABLE public.programme_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.persona_projects(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'proposed',
  starts_on date,
  ends_on date,
  summary text,
  objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  method_mix jsonb NOT NULL DEFAULT '[]'::jsonb,
  audience jsonb NOT NULL DEFAULT '[]'::jsonb,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  rationale jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_proposal jsonb,
  visibility text NOT NULL DEFAULT 'private',
  owner_country_code text,
  uploaded_by uuid,
  created_by uuid,
  committed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programme_plans TO authenticated;
GRANT ALL ON public.programme_plans TO service_role;
ALTER TABLE public.programme_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country access manages programme_plans" ON public.programme_plans
  FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE TABLE public.programme_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.programme_plans(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  name text NOT NULL,
  intent text,
  position integer NOT NULL DEFAULT 0,
  starts_on date,
  ends_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programme_phases TO authenticated;
GRANT ALL ON public.programme_phases TO service_role;
ALTER TABLE public.programme_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country access manages programme_phases" ON public.programme_phases
  FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE TABLE public.programme_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.programme_plans(id) ON DELETE CASCADE,
  phase_id uuid REFERENCES public.programme_phases(id) ON DELETE SET NULL,
  country_code text NOT NULL,
  title text NOT NULL,
  detail text,
  owner text,
  starts_on date,
  due_on date,
  status text NOT NULL DEFAULT 'planned',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programme_milestones TO authenticated;
GRANT ALL ON public.programme_milestones TO service_role;
ALTER TABLE public.programme_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country access manages programme_milestones" ON public.programme_milestones
  FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE TABLE public.programme_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.programme_plans(id) ON DELETE CASCADE,
  milestone_id uuid REFERENCES public.programme_milestones(id) ON DELETE SET NULL,
  country_code text NOT NULL,
  title text NOT NULL,
  kind text,
  detail text,
  owner text,
  due_on date,
  status text NOT NULL DEFAULT 'planned',
  storage_path text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programme_deliverables TO authenticated;
GRANT ALL ON public.programme_deliverables TO service_role;
ALTER TABLE public.programme_deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country access manages programme_deliverables" ON public.programme_deliverables
  FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

-- ── Participant CRM ───────────────────────────────────────────────────────
CREATE TABLE public.research_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  full_name text NOT NULL,
  email text,
  email_norm text,
  phone text,
  phone_norm text,
  organisation text,
  role_title text,
  tags text[] NOT NULL DEFAULT '{}',
  source text,
  consent_status text NOT NULL DEFAULT 'unknown',
  opted_out_at timestamptz,
  notes text,
  last_contacted_at timestamptz,
  visibility text NOT NULL DEFAULT 'private',
  owner_country_code text,
  uploaded_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX research_contacts_email_key ON public.research_contacts (country_code, email_norm) WHERE email_norm IS NOT NULL;
CREATE UNIQUE INDEX research_contacts_phone_key ON public.research_contacts (country_code, phone_norm) WHERE phone_norm IS NOT NULL AND email_norm IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_contacts TO authenticated;
GRANT ALL ON public.research_contacts TO service_role;
ALTER TABLE public.research_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country access manages research_contacts" ON public.research_contacts
  FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE TABLE public.research_panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  project_id uuid REFERENCES public.persona_projects(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_panels TO authenticated;
GRANT ALL ON public.research_panels TO service_role;
ALTER TABLE public.research_panels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country access manages research_panels" ON public.research_panels
  FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE TABLE public.research_panel_members (
  panel_id uuid NOT NULL REFERENCES public.research_panels(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.research_contacts(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (panel_id, contact_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_panel_members TO authenticated;
GRANT ALL ON public.research_panel_members TO service_role;
ALTER TABLE public.research_panel_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country access manages research_panel_members" ON public.research_panel_members
  FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

-- ── Field studies: instruments, collections, responses ────────────────────
CREATE TABLE public.field_instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  kind text NOT NULL DEFAULT 'survey',
  title text,
  intro text,
  outro text,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  generated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_instruments TO authenticated;
GRANT ALL ON public.field_instruments TO service_role;
ALTER TABLE public.field_instruments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country access manages field_instruments" ON public.field_instruments
  FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE TABLE public.field_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  instrument_id uuid REFERENCES public.field_instruments(id) ON DELETE SET NULL,
  country_code text NOT NULL,
  mode text NOT NULL DEFAULT 'hosted',
  access text NOT NULL DEFAULT 'invited',
  public_token text UNIQUE,
  status text NOT NULL DEFAULT 'draft',
  target_n integer,
  response_cap integer,
  opens_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_collections TO authenticated;
GRANT ALL ON public.field_collections TO service_role;
ALTER TABLE public.field_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country access manages field_collections" ON public.field_collections
  FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE TABLE public.research_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  study_id uuid REFERENCES public.studies(id) ON DELETE CASCADE,
  collection_id uuid REFERENCES public.field_collections(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.research_contacts(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  participant_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  invited_at timestamptz,
  opened_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  declined_at timestamptz,
  reminder_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX research_invitations_collection_idx ON public.research_invitations (collection_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.research_invitations TO authenticated;
GRANT ALL ON public.research_invitations TO service_role;
ALTER TABLE public.research_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country access manages research_invitations" ON public.research_invitations
  FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE TABLE public.field_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.field_collections(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  invitation_id uuid REFERENCES public.research_invitations(id) ON DELETE SET NULL,
  participant_code text NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'hosted',
  ingested_to_corpus_at timestamptz,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX field_responses_collection_idx ON public.field_responses (collection_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_responses TO authenticated;
GRANT ALL ON public.field_responses TO service_role;
ALTER TABLE public.field_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country access manages field_responses" ON public.field_responses
  FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

-- ── Sessions ──────────────────────────────────────────────────────────────
CREATE TABLE public.field_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  title text NOT NULL,
  method text NOT NULL DEFAULT 'focus_group',
  scheduled_at timestamptz,
  duration_minutes integer,
  venue text,
  join_url text,
  moderator text,
  status text NOT NULL DEFAULT 'scheduled',
  recording_path text,
  transcript text,
  notes text,
  ingested_to_corpus_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_sessions TO authenticated;
GRANT ALL ON public.field_sessions TO service_role;
ALTER TABLE public.field_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country access manages field_sessions" ON public.field_sessions
  FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE TABLE public.field_session_attendees (
  session_id uuid NOT NULL REFERENCES public.field_sessions(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.research_contacts(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  participant_code text,
  rsvp text NOT NULL DEFAULT 'invited',
  attended boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, contact_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_session_attendees TO authenticated;
GRANT ALL ON public.field_session_attendees TO service_role;
ALTER TABLE public.field_session_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country access manages field_session_attendees" ON public.field_session_attendees
  FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

-- ── Communications ────────────────────────────────────────────────────────
CREATE TABLE public.comms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  project_id uuid REFERENCES public.persona_projects(id) ON DELETE CASCADE,
  study_id uuid REFERENCES public.studies(id) ON DELETE CASCADE,
  purpose text NOT NULL DEFAULT 'invite',
  channel text NOT NULL DEFAULT 'email',
  subject text,
  body text NOT NULL DEFAULT '',
  generated_by text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comms_templates TO authenticated;
GRANT ALL ON public.comms_templates TO service_role;
ALTER TABLE public.comms_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country access manages comms_templates" ON public.comms_templates
  FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE TABLE public.comms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  contact_id uuid REFERENCES public.research_contacts(id) ON DELETE SET NULL,
  study_id uuid REFERENCES public.studies(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.field_sessions(id) ON DELETE SET NULL,
  invitation_id uuid REFERENCES public.research_invitations(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.comms_templates(id) ON DELETE SET NULL,
  purpose text NOT NULL DEFAULT 'invite',
  channel text NOT NULL DEFAULT 'email',
  to_address text,
  subject text,
  body text,
  status text NOT NULL DEFAULT 'queued',
  error text,
  sent_at timestamptz,
  sent_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX comms_log_contact_idx ON public.comms_log (contact_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comms_log TO authenticated;
GRANT ALL ON public.comms_log TO service_role;
ALTER TABLE public.comms_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country access manages comms_log" ON public.comms_log
  FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

-- ── Studies: mode / method / milestone link ───────────────────────────────
ALTER TABLE public.studies
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'synthetic',
  ADD COLUMN IF NOT EXISTS method text,
  ADD COLUMN IF NOT EXISTS programme_milestone_id uuid REFERENCES public.programme_milestones(id) ON DELETE SET NULL;

-- ── updated_at triggers ───────────────────────────────────────────────────
CREATE TRIGGER trg_programme_plans_updated BEFORE UPDATE ON public.programme_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_programme_phases_updated BEFORE UPDATE ON public.programme_phases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_programme_milestones_updated BEFORE UPDATE ON public.programme_milestones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_programme_deliverables_updated BEFORE UPDATE ON public.programme_deliverables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_research_contacts_updated BEFORE UPDATE ON public.research_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_research_panels_updated BEFORE UPDATE ON public.research_panels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_field_instruments_updated BEFORE UPDATE ON public.field_instruments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_field_collections_updated BEFORE UPDATE ON public.field_collections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_research_invitations_updated BEFORE UPDATE ON public.research_invitations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_field_responses_updated BEFORE UPDATE ON public.field_responses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_field_sessions_updated BEFORE UPDATE ON public.field_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_comms_templates_updated BEFORE UPDATE ON public.comms_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_comms_log_updated BEFORE UPDATE ON public.comms_log FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
