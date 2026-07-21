
CREATE TYPE public.service_request_status AS ENUM ('draft','new','triaged','in_progress','review','ready','delivered','accepted','revising','closed');
CREATE TYPE public.service_request_channel AS ENUM ('typed','pasted','voice');
CREATE TYPE public.service_request_chamber AS ENUM ('ledger','portfolio','scenario','fdi','narrative','cabinet','persona');

CREATE TABLE public.service_request_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  step smallint NOT NULL DEFAULT 1,
  raw_text text,
  channel public.service_request_channel,
  minister_summary text,
  request_card jsonb NOT NULL DEFAULT '{}'::jsonb,
  internal_chamber public.service_request_chamber,
  chamber_confidence numeric,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, country_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_request_drafts TO authenticated;
GRANT ALL ON public.service_request_drafts TO service_role;
ALTER TABLE public.service_request_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_draft_rw" ON public.service_request_drafts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_service_request_drafts_updated
  BEFORE UPDATE ON public.service_request_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_name text,
  requester_title text,
  status public.service_request_status NOT NULL DEFAULT 'new',
  question text NOT NULL,
  why_it_matters text,
  deliverable_shape text,
  built_on jsonb NOT NULL DEFAULT '[]'::jsonb,
  when_needed text,
  minister_summary text,
  submitted_channel public.service_request_channel,
  internal_chamber public.service_request_chamber,
  chamber_confidence numeric,
  internal_notes text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expected_by timestamptz,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_intake text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_service_requests_country ON public.service_requests(country_code);
CREATE INDEX idx_service_requests_status ON public.service_requests(status);
CREATE INDEX idx_service_requests_requester ON public.service_requests(requester_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_requests TO authenticated;
GRANT ALL ON public.service_requests TO service_role;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "requester_read_own" ON public.service_requests
  FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR public.has_country_access(auth.uid(), country_code) OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "requester_insert_own" ON public.service_requests
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND public.has_country_access(auth.uid(), country_code));
CREATE POLICY "admin_update" ON public.service_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR requester_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR requester_id = auth.uid());
CREATE TRIGGER trg_service_requests_updated
  BEFORE UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.service_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_kind text NOT NULL DEFAULT 'agency' CHECK (actor_kind IN ('minister','agency','system')),
  event_type text NOT NULL,
  minister_summary text,
  internal_note text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_service_request_events_request ON public.service_request_events(request_id, created_at DESC);
GRANT SELECT, INSERT ON public.service_request_events TO authenticated;
GRANT ALL ON public.service_request_events TO service_role;
ALTER TABLE public.service_request_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_read" ON public.service_request_events
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_requests r WHERE r.id = request_id
    AND (r.requester_id = auth.uid() OR public.has_country_access(auth.uid(), r.country_code) OR public.has_role(auth.uid(), 'admin'::public.app_role))));
CREATE POLICY "events_insert" ON public.service_request_events
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.service_requests r WHERE r.id = request_id
    AND (r.requester_id = auth.uid() OR public.has_country_access(auth.uid(), r.country_code) OR public.has_role(auth.uid(), 'admin'::public.app_role))));

CREATE TABLE public.service_request_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  title text NOT NULL,
  minister_body_md text,
  internal_body_md text,
  chamber public.service_request_chamber,
  chamber_ref_id uuid,
  chamber_ref_kind text,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  authored_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  delivered_at timestamptz,
  read_at timestamptz,
  acted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_deliverables_request ON public.service_request_deliverables(request_id);
CREATE INDEX idx_deliverables_chamber ON public.service_request_deliverables(chamber);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_request_deliverables TO authenticated;
GRANT ALL ON public.service_request_deliverables TO service_role;
ALTER TABLE public.service_request_deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deliverables_read" ON public.service_request_deliverables
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_requests r WHERE r.id = request_id
    AND (r.requester_id = auth.uid() OR public.has_country_access(auth.uid(), r.country_code) OR public.has_role(auth.uid(), 'admin'::public.app_role))));
CREATE POLICY "deliverables_admin_write" ON public.service_request_deliverables
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "deliverables_requester_mark_read" ON public.service_request_deliverables
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.service_requests r WHERE r.id = request_id AND r.requester_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.service_requests r WHERE r.id = request_id AND r.requester_id = auth.uid()));
CREATE TRIGGER trg_deliverables_updated
  BEFORE UPDATE ON public.service_request_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "service_requests_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'service-requests' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'service-requests' AND owner = auth.uid());
CREATE POLICY "service_requests_admin_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'service-requests' AND public.has_role(auth.uid(), 'admin'::public.app_role));
