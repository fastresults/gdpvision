-- 0012 · Digital Government Studio (chamber 09)
--
-- A per-country product requirements document for a national e-government
-- platform, written one section at a time from the country's own corpus,
-- edited by people, approved by a second person, and shared read-only.
--
--   1. Capability helper: who may approve a PRD.
--   2. PRDs and their sections, citations and snapshots.
--   3. Status machine, two-person rule, edit reopens approval; history to audit_log.
--   4. Share links and views (same shape as investment share links).
--
-- Every write path through the service role (auth.uid() IS NULL) skips the
-- actor checks but is still recorded in the history.

-- ---------------------------------------------------------------- 1 helpers

CREATE OR REPLACE FUNCTION public.can_approve_egov(_user_id uuid, _country_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_country_role(_user_id, _country_code,
    ARRAY['country_admin','cabinet_secretary']::public.app_role[]);
$$;
REVOKE EXECUTE ON FUNCTION public.can_approve_egov(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_approve_egov(uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------- 2 tables

CREATE TABLE IF NOT EXISTS public.egov_prds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','approved','returned','superseded')),
  -- Wizard answers: { platform_name, audiences[], priorities[], hosting, notes }
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Resolved brand tokens (src/lib/egov/brand.ts) at generation time.
  brand jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  created_by uuid DEFAULT auth.uid(),
  submitted_by uuid,
  submitted_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  returned_by uuid,
  returned_at timestamptz,
  returned_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS egov_prds_country_idx ON public.egov_prds (country_code, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.egov_prds TO authenticated;
GRANT ALL ON public.egov_prds TO service_role;
ALTER TABLE public.egov_prds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "country access prds" ON public.egov_prds;
CREATE POLICY "country access prds" ON public.egov_prds FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE TABLE IF NOT EXISTS public.egov_prd_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prd_id uuid NOT NULL REFERENCES public.egov_prds(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  stage_key text NOT NULL,
  ordinal integer NOT NULL,
  heading text NOT NULL,
  body_md text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','drafted','edited','gap','stale')),
  -- Hash of the context pack the section was written from; stale when it changes.
  context_hash text,
  -- The exact context lines the model saw, for the provenance rail.
  context jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  authored_at timestamptz,
  edited_by uuid,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prd_id, stage_key)
);
CREATE INDEX IF NOT EXISTS egov_prd_sections_prd_idx ON public.egov_prd_sections (prd_id, ordinal);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.egov_prd_sections TO authenticated;
GRANT ALL ON public.egov_prd_sections TO service_role;
ALTER TABLE public.egov_prd_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "country access prd sections" ON public.egov_prd_sections;
CREATE POLICY "country access prd sections" ON public.egov_prd_sections FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE TABLE IF NOT EXISTS public.egov_prd_citations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.egov_prd_sections(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('corpus_row','repo_file','research_url','user')),
  -- corpus_row: "<table>:<id>"; repo_file: a path; research_url: the URL.
  source_ref text NOT NULL,
  label text NOT NULL,
  excerpt text,
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS egov_prd_citations_section_idx ON public.egov_prd_citations (section_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.egov_prd_citations TO authenticated;
GRANT ALL ON public.egov_prd_citations TO service_role;
ALTER TABLE public.egov_prd_citations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "country access prd citations" ON public.egov_prd_citations;
CREATE POLICY "country access prd citations" ON public.egov_prd_citations FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE TABLE IF NOT EXISTS public.egov_prd_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prd_id uuid NOT NULL REFERENCES public.egov_prds(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  reason text NOT NULL,
  taken_at timestamptz NOT NULL DEFAULT now(),
  sections jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS egov_prd_snapshots_prd_idx ON public.egov_prd_snapshots (prd_id, taken_at DESC);
GRANT SELECT, INSERT ON public.egov_prd_snapshots TO authenticated;
GRANT ALL ON public.egov_prd_snapshots TO service_role;
ALTER TABLE public.egov_prd_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "country access prd snapshots" ON public.egov_prd_snapshots;
CREATE POLICY "country access prd snapshots" ON public.egov_prd_snapshots FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

-- ---------------------------------------------------------------- 3 governance

CREATE OR REPLACE FUNCTION public.egov_prds_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  changed boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF actor IS NOT NULL AND OLD.status NOT IN ('draft','superseded') THEN
      RAISE EXCEPTION 'Only a draft or superseded PRD can be deleted. Withdraw it first.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF actor IS NOT NULL THEN NEW.status := 'draft'; END IF;
    NEW.created_by := COALESCE(actor, NEW.created_by);
    NEW.version := COALESCE((SELECT max(version) FROM public.egov_prds WHERE country_code = NEW.country_code), 0) + 1;
    NEW.submitted_by := NULL; NEW.submitted_at := NULL;
    NEW.approved_by := NULL; NEW.approved_at := NULL;
    NEW.returned_by := NULL; NEW.returned_at := NULL; NEW.returned_note := NULL;
    RETURN NEW;
  END IF;

  IF NEW.country_code IS DISTINCT FROM OLD.country_code THEN
    RAISE EXCEPTION 'A PRD cannot be moved to another country.';
  END IF;
  NEW.updated_at := now();
  IF actor IS NULL THEN RETURN NEW; END IF;

  changed := (NEW.title, NEW.scope, NEW.brand) IS DISTINCT FROM (OLD.title, OLD.scope, OLD.brand);

  -- Governance columns are never client-writable.
  NEW.created_by := OLD.created_by; NEW.version := OLD.version;
  NEW.submitted_by := OLD.submitted_by; NEW.submitted_at := OLD.submitted_at;
  NEW.approved_by := OLD.approved_by; NEW.approved_at := OLD.approved_at;
  NEW.returned_by := OLD.returned_by; NEW.returned_at := OLD.returned_at;
  IF NOT (NEW.status = 'returned' AND OLD.status = 'submitted') THEN
    NEW.returned_note := OLD.returned_note;
  END IF;

  IF NEW.status = OLD.status THEN
    IF changed AND OLD.status IN ('submitted','approved') THEN
      NEW.status := 'draft';
      NEW.submitted_by := NULL; NEW.submitted_at := NULL;
      NEW.approved_by := NULL; NEW.approved_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status IN ('draft','returned') AND NEW.status = 'submitted' THEN
    IF EXISTS (SELECT 1 FROM public.egov_prd_sections s WHERE s.prd_id = NEW.id AND s.status = 'pending') THEN
      RAISE EXCEPTION 'Every section must be drafted before the PRD is submitted for approval.';
    END IF;
    NEW.submitted_by := actor; NEW.submitted_at := now();
    NEW.returned_by := NULL; NEW.returned_at := NULL;

  ELSIF OLD.status = 'submitted' AND NEW.status = 'approved' THEN
    IF changed THEN RAISE EXCEPTION 'Approving cannot change the PRD. Return it with a note instead.'; END IF;
    IF actor = OLD.submitted_by THEN
      RAISE EXCEPTION 'Two-person rule: the person who submitted this PRD cannot approve it.';
    END IF;
    IF NOT public.can_approve_egov(actor, OLD.country_code) THEN
      RAISE EXCEPTION 'You do not hold an approver role for this country.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.egov_prd_sections s WHERE s.prd_id = NEW.id AND s.status = 'stale') THEN
      RAISE EXCEPTION 'A section is out of date with the corpus. Refresh it before approval.';
    END IF;
    NEW.approved_by := actor; NEW.approved_at := now();
    UPDATE public.egov_prds SET status = 'superseded'
      WHERE country_code = NEW.country_code AND status = 'approved' AND id <> NEW.id;

  ELSIF OLD.status = 'submitted' AND NEW.status = 'returned' THEN
    IF changed THEN RAISE EXCEPTION 'Returning cannot change the PRD.'; END IF;
    IF actor = OLD.submitted_by OR NOT public.can_approve_egov(actor, OLD.country_code) THEN
      RAISE EXCEPTION 'Only an approver other than the submitter can return a PRD.';
    END IF;
    IF COALESCE(btrim(NEW.returned_note), '') = '' THEN
      RAISE EXCEPTION 'Say what needs to change when returning a PRD.';
    END IF;
    NEW.returned_by := actor; NEW.returned_at := now();

  ELSIF OLD.status = 'submitted' AND NEW.status = 'draft' THEN
    IF actor <> OLD.submitted_by AND NOT public.can_approve_egov(actor, OLD.country_code) THEN
      RAISE EXCEPTION 'Only the submitter or an approver can withdraw a PRD.';
    END IF;
    NEW.submitted_by := NULL; NEW.submitted_at := NULL;

  ELSIF OLD.status = 'approved' AND NEW.status = 'draft' THEN
    IF NOT public.can_approve_egov(actor, OLD.country_code) THEN
      RAISE EXCEPTION 'Only an approver can reopen an approved PRD.';
    END IF;
    NEW.submitted_by := NULL; NEW.submitted_at := NULL;
    NEW.approved_by := NULL; NEW.approved_at := NULL;

  ELSIF OLD.status = 'approved' AND NEW.status = 'superseded' THEN
    NULL;

  ELSE
    RAISE EXCEPTION 'A PRD cannot move from % to %.', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.egov_prds_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  act text;
  r record;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  IF TG_OP = 'INSERT' THEN act := 'egov_prd.created';
  ELSIF TG_OP = 'DELETE' THEN act := 'egov_prd.deleted';
  ELSIF NEW.status <> OLD.status THEN
    act := CASE
      WHEN NEW.status = 'submitted' THEN 'egov_prd.submitted'
      WHEN NEW.status = 'approved' THEN 'egov_prd.approved'
      WHEN NEW.status = 'returned' THEN 'egov_prd.returned'
      WHEN NEW.status = 'superseded' THEN 'egov_prd.superseded'
      WHEN OLD.status = 'submitted' THEN 'egov_prd.withdrawn'
      ELSE 'egov_prd.reopened' END;
  ELSIF (NEW.title, NEW.scope, NEW.brand) IS DISTINCT FROM (OLD.title, OLD.scope, OLD.brand) THEN
    act := 'egov_prd.edited';
  ELSE RETURN NULL;
  END IF;
  PERFORM public.log_governance(act, 'egov_prd', r.id::text, r.country_code,
    jsonb_build_object(
      'title', r.title,
      'from', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END,
      'to', CASE WHEN TG_OP <> 'DELETE' THEN NEW.status END,
      'version', r.version,
      'note', CASE WHEN act = 'egov_prd.returned' THEN NEW.returned_note END));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS egov_prds_guard ON public.egov_prds;
CREATE TRIGGER egov_prds_guard BEFORE INSERT OR UPDATE OR DELETE ON public.egov_prds
  FOR EACH ROW EXECUTE FUNCTION public.egov_prds_guard();
DROP TRIGGER IF EXISTS egov_prds_history ON public.egov_prds;
CREATE TRIGGER egov_prds_history AFTER INSERT OR UPDATE OR DELETE ON public.egov_prds
  FOR EACH ROW EXECUTE FUNCTION public.egov_prds_history();

-- A section edit on a submitted or approved PRD reopens it, and records who edited.
CREATE OR REPLACE FUNCTION public.egov_prd_sections_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  parent public.egov_prds;
BEGIN
  SELECT * INTO parent FROM public.egov_prds WHERE id = NEW.prd_id;
  IF parent.id IS NULL THEN RAISE EXCEPTION 'Unknown PRD.'; END IF;
  NEW.country_code := parent.country_code;
  IF TG_OP = 'UPDATE' AND actor IS NOT NULL THEN
    IF NEW.body_md IS DISTINCT FROM OLD.body_md THEN
      NEW.edited_by := actor; NEW.edited_at := now();
      IF NEW.status NOT IN ('gap','pending') THEN NEW.status := 'edited'; END IF;
      IF parent.status IN ('submitted','approved') THEN
        UPDATE public.egov_prds SET status = 'draft', submitted_by = NULL, submitted_at = NULL,
          approved_by = NULL, approved_at = NULL WHERE id = parent.id;
        PERFORM public.log_governance('egov_prd.reopened', 'egov_prd', parent.id::text, parent.country_code,
          jsonb_build_object('title', parent.title, 'from', parent.status, 'to', 'draft',
                             'version', parent.version, 'section', NEW.stage_key));
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS egov_prd_sections_guard ON public.egov_prd_sections;
CREATE TRIGGER egov_prd_sections_guard BEFORE INSERT OR UPDATE ON public.egov_prd_sections
  FOR EACH ROW EXECUTE FUNCTION public.egov_prd_sections_guard();

-- ---------------------------------------------------------------- 4 share links

CREATE TABLE IF NOT EXISTS public.egov_prd_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prd_id uuid NOT NULL REFERENCES public.egov_prds(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  token_hint text NOT NULL,
  label text NOT NULL,
  max_views integer CHECK (max_views IS NULL OR max_views > 0),
  view_count integer NOT NULL DEFAULT 0,
  last_viewed_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_by uuid,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at <= created_at + interval '180 days')
);
GRANT SELECT, INSERT, UPDATE ON public.egov_prd_share_links TO authenticated;
GRANT ALL ON public.egov_prd_share_links TO service_role;
ALTER TABLE public.egov_prd_share_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read prd links" ON public.egov_prd_share_links;
CREATE POLICY "read prd links" ON public.egov_prd_share_links FOR SELECT TO authenticated
  USING (public.has_country_access(auth.uid(), country_code));
DROP POLICY IF EXISTS "approvers create prd links" ON public.egov_prd_share_links;
CREATE POLICY "approvers create prd links" ON public.egov_prd_share_links FOR INSERT TO authenticated
  WITH CHECK (public.can_approve_egov(auth.uid(), country_code));
DROP POLICY IF EXISTS "approvers revoke prd links" ON public.egov_prd_share_links;
CREATE POLICY "approvers revoke prd links" ON public.egov_prd_share_links FOR UPDATE TO authenticated
  USING (public.can_approve_egov(auth.uid(), country_code))
  WITH CHECK (public.can_approve_egov(auth.uid(), country_code));

CREATE OR REPLACE FUNCTION public.egov_prd_share_links_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  parent public.egov_prds;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO parent FROM public.egov_prds WHERE id = NEW.prd_id;
    IF parent.status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'Only an approved PRD can be shared.';
    END IF;
    NEW.country_code := parent.country_code;
    NEW.created_by := COALESCE(actor, NEW.created_by);
    NEW.view_count := 0; NEW.last_viewed_at := NULL; NEW.revoked_at := NULL; NEW.revoked_by := NULL;
    PERFORM public.log_governance('egov_share_link.created', 'egov_prd', NEW.prd_id::text, NEW.country_code,
      jsonb_build_object('label', NEW.label, 'expires_at', NEW.expires_at, 'hint', NEW.token_hint));
    RETURN NEW;
  END IF;
  IF actor IS NULL THEN RETURN NEW; END IF;
  IF (NEW.prd_id, NEW.country_code, NEW.token_hash, NEW.token_hint, NEW.label, NEW.max_views,
      NEW.expires_at, NEW.view_count, NEW.last_viewed_at, NEW.created_by, NEW.created_at)
     IS DISTINCT FROM
     (OLD.prd_id, OLD.country_code, OLD.token_hash, OLD.token_hint, OLD.label, OLD.max_views,
      OLD.expires_at, OLD.view_count, OLD.last_viewed_at, OLD.created_by, OLD.created_at) THEN
    RAISE EXCEPTION 'A share link cannot be edited, only revoked. Create a new one instead.';
  END IF;
  IF OLD.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'This link is already revoked.'; END IF;
  IF NEW.revoked_at IS NOT NULL THEN
    NEW.revoked_at := now(); NEW.revoked_by := actor;
    PERFORM public.log_governance('egov_share_link.revoked', 'egov_prd', NEW.prd_id::text, NEW.country_code,
      jsonb_build_object('label', NEW.label, 'hint', NEW.token_hint));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS egov_prd_share_links_guard ON public.egov_prd_share_links;
CREATE TRIGGER egov_prd_share_links_guard BEFORE INSERT OR UPDATE ON public.egov_prd_share_links
  FOR EACH ROW EXECUTE FUNCTION public.egov_prd_share_links_guard();

-- Counts a view atomically and records it. Service role only: called by the public page.
CREATE OR REPLACE FUNCTION public.record_egov_prd_view(_link_id uuid, _visitor_hash text, _user_agent text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cc text;
BEGIN
  UPDATE public.egov_prd_share_links
     SET view_count = view_count + 1, last_viewed_at = now()
   WHERE id = _link_id AND revoked_at IS NULL AND expires_at > now()
     AND (max_views IS NULL OR view_count < max_views)
  RETURNING country_code INTO cc;
  IF cc IS NULL THEN RETURN false; END IF;
  PERFORM public.log_governance('egov_share_link.viewed', 'egov_prd_share_link', _link_id::text, cc,
    jsonb_build_object('visitor', _visitor_hash, 'user_agent', left(_user_agent, 120)));
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_egov_prd_view(uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_egov_prd_view(uuid, text, text) TO service_role;

-- Public PRD links are off until an admin turns them on.
INSERT INTO public.app_settings (key, value) VALUES ('public_prd_links_enabled', 'false')
ON CONFLICT (key) DO NOTHING;