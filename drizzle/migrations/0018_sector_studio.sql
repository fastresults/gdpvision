-- 0018 · Sector Studio (chamber 10)
--
-- A per-sector development plan, written stage by stage from the country's
-- corpus, edited by people, approved by a second person, and turned into a
-- Cabinet commitment on approval. Same governance shape as the Digital
-- Government Studio (0012, 0014).
--
--   1. Roles and capability helpers.
--   2. The Scout's shortlist and the Head of Government's priority sectors
--      (at most four active per country).
--   3. Plans, sections, citations, snapshots.
--   4. Status machine, two-person rule (with the sole-admin exception),
--      edit reopens approval, approval raises a Cabinet commitment;
--      history to audit_log.
--
-- Every write through the service role (auth.uid() IS NULL) skips the actor
-- checks but is still recorded in the history.

-- ---------------------------------------------------------------- 1 roles and helpers

-- Council and delivery roles for Phase 2. Added now so the role list is
-- stable; nothing in this migration depends on them.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sector_minister';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sector_council_chair';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sector_council_member';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'delivery_lead';

-- Who may choose priority sectors and approve a plan.
CREATE OR REPLACE FUNCTION public.can_approve_sector(_user_id uuid, _country_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_country_role(_user_id, _country_code,
    ARRAY['country_admin','cabinet_secretary']::public.app_role[]);
$$;
REVOKE EXECUTE ON FUNCTION public.can_approve_sector(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_approve_sector(uuid, text) TO authenticated, service_role;

-- Global admin, and nobody else holds an approver role for the country
-- (the same approver set as chamber 09; see 0014).
CREATE OR REPLACE FUNCTION public.can_sole_approve_sector(_user_id uuid, _country_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
     AND NOT public.egov_other_approver_exists(_user_id, _country_code);
$$;
REVOKE EXECUTE ON FUNCTION public.can_sole_approve_sector(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_sole_approve_sector(uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------- 2 shortlist and priorities

-- The Scout's view of every sector: a recommendation, a score and a brief,
-- written from the corpus. Advisory; regenerated on demand.
CREATE TABLE IF NOT EXISTS public.sector_shortlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  sector_code text NOT NULL,
  recommendation text NOT NULL CHECK (recommendation IN ('recommend','consider','hold')),
  score integer NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  headline text NOT NULL DEFAULT '',
  brief_md text NOT NULL DEFAULT '',
  -- [{ key, label, ref, why }]
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  context_hash text,
  model text,
  generated_by uuid DEFAULT auth.uid(),
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, sector_code)
);
CREATE INDEX IF NOT EXISTS sector_shortlists_country_idx ON public.sector_shortlists (country_code, score DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sector_shortlists TO authenticated;
GRANT ALL ON public.sector_shortlists TO service_role;
ALTER TABLE public.sector_shortlists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "country access sector shortlists" ON public.sector_shortlists;
CREATE POLICY "country access sector shortlists" ON public.sector_shortlists FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

-- The Head of Government's choice: which sectors are national priorities.
CREATE TABLE IF NOT EXISTS public.sector_priorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  sector_code text NOT NULL,
  status text NOT NULL DEFAULT 'priority' CHECK (status IN ('priority','retired')),
  rationale text NOT NULL DEFAULT '',
  exit_rule text NOT NULL DEFAULT '',
  chosen_by uuid,
  chosen_at timestamptz,
  retired_by uuid,
  retired_at timestamptz,
  retired_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, sector_code)
);
CREATE INDEX IF NOT EXISTS sector_priorities_country_idx ON public.sector_priorities (country_code, status);
GRANT SELECT, INSERT, UPDATE ON public.sector_priorities TO authenticated;
GRANT ALL ON public.sector_priorities TO service_role;
ALTER TABLE public.sector_priorities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read sector priorities" ON public.sector_priorities;
CREATE POLICY "read sector priorities" ON public.sector_priorities FOR SELECT TO authenticated
  USING (public.has_country_access(auth.uid(), country_code));
DROP POLICY IF EXISTS "choose sector priorities" ON public.sector_priorities;
CREATE POLICY "choose sector priorities" ON public.sector_priorities FOR INSERT TO authenticated
  WITH CHECK (public.can_approve_sector(auth.uid(), country_code));
DROP POLICY IF EXISTS "change sector priorities" ON public.sector_priorities;
CREATE POLICY "change sector priorities" ON public.sector_priorities FOR UPDATE TO authenticated
  USING (public.can_approve_sector(auth.uid(), country_code))
  WITH CHECK (public.can_approve_sector(auth.uid(), country_code));

CREATE OR REPLACE FUNCTION public.sector_priorities_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  active integer;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.country_code IS DISTINCT FROM OLD.country_code THEN
    RAISE EXCEPTION 'A priority cannot be moved to another country.';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.sector_code IS DISTINCT FROM OLD.sector_code THEN
    RAISE EXCEPTION 'A priority cannot be moved to another sector.';
  END IF;
  NEW.updated_at := now();

  IF NEW.status = 'priority' AND (TG_OP = 'INSERT' OR OLD.status <> 'priority') THEN
    SELECT count(*) INTO active FROM public.sector_priorities
      WHERE country_code = NEW.country_code AND status = 'priority' AND id <> NEW.id;
    IF active >= 4 THEN
      RAISE EXCEPTION 'A country holds at most four priority sectors. Retire one before choosing another.';
    END IF;
    IF COALESCE(btrim(NEW.rationale), '') = '' AND actor IS NOT NULL THEN
      RAISE EXCEPTION 'Say why this sector is a priority.';
    END IF;
    NEW.chosen_by := COALESCE(actor, NEW.chosen_by); NEW.chosen_at := now();
    NEW.retired_by := NULL; NEW.retired_at := NULL; NEW.retired_note := NULL;
  ELSIF NEW.status = 'retired' AND TG_OP = 'UPDATE' AND OLD.status = 'priority' THEN
    IF COALESCE(btrim(NEW.retired_note), '') = '' AND actor IS NOT NULL THEN
      RAISE EXCEPTION 'Say why this sector is being retired as a priority.';
    END IF;
    NEW.retired_by := COALESCE(actor, NEW.retired_by); NEW.retired_at := now();
    NEW.chosen_by := OLD.chosen_by; NEW.chosen_at := OLD.chosen_at;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.chosen_by := OLD.chosen_by; NEW.chosen_at := OLD.chosen_at;
    NEW.retired_by := OLD.retired_by; NEW.retired_at := OLD.retired_at;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sector_priorities_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE act text;
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status <> OLD.status) THEN
    act := CASE WHEN NEW.status = 'priority' THEN 'sector_priority.chosen' ELSE 'sector_priority.retired' END;
  ELSIF (NEW.rationale, NEW.exit_rule) IS DISTINCT FROM (OLD.rationale, OLD.exit_rule) THEN
    act := 'sector_priority.edited';
  ELSE RETURN NULL;
  END IF;
  PERFORM public.log_governance(act, 'sector_priority', NEW.country_code || ':' || NEW.sector_code,
    NEW.country_code, jsonb_build_object('sector', NEW.sector_code, 'to', NEW.status,
      'note', CASE WHEN NEW.status = 'retired' THEN NEW.retired_note ELSE NEW.rationale END));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sector_priorities_guard ON public.sector_priorities;
CREATE TRIGGER sector_priorities_guard BEFORE INSERT OR UPDATE ON public.sector_priorities
  FOR EACH ROW EXECUTE FUNCTION public.sector_priorities_guard();
DROP TRIGGER IF EXISTS sector_priorities_history ON public.sector_priorities;
CREATE TRIGGER sector_priorities_history AFTER INSERT OR UPDATE ON public.sector_priorities
  FOR EACH ROW EXECUTE FUNCTION public.sector_priorities_history();

-- ---------------------------------------------------------------- 3 plans

CREATE TABLE IF NOT EXISTS public.sector_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  sector_code text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','approved','returned','superseded')),
  -- Wizard answers: { lead_ministry, horizon_years, ambition, focus[], notes }
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  created_by uuid DEFAULT auth.uid(),
  submitted_by uuid,
  submitted_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  approval_mode text CHECK (approval_mode IS NULL OR approval_mode IN ('two_person','sole_admin')),
  returned_by uuid,
  returned_at timestamptz,
  returned_note text,
  -- The Cabinet commitment raised when this version was approved.
  commitment_id uuid REFERENCES public.commitments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sector_plans_country_idx ON public.sector_plans (country_code, sector_code, version DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sector_plans TO authenticated;
GRANT ALL ON public.sector_plans TO service_role;
ALTER TABLE public.sector_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "country access sector plans" ON public.sector_plans;
CREATE POLICY "country access sector plans" ON public.sector_plans FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE TABLE IF NOT EXISTS public.sector_plan_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.sector_plans(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  stage_key text NOT NULL,
  ordinal integer NOT NULL,
  heading text NOT NULL,
  body_md text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','drafted','edited','gap','stale')),
  context_hash text,
  context jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- The Auditor's findings for this section: [{ kind, message }]
  audit jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  authored_at timestamptz,
  edited_by uuid,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, stage_key)
);
CREATE INDEX IF NOT EXISTS sector_plan_sections_plan_idx ON public.sector_plan_sections (plan_id, ordinal);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sector_plan_sections TO authenticated;
GRANT ALL ON public.sector_plan_sections TO service_role;
ALTER TABLE public.sector_plan_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "country access sector plan sections" ON public.sector_plan_sections;
CREATE POLICY "country access sector plan sections" ON public.sector_plan_sections FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE TABLE IF NOT EXISTS public.sector_plan_citations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.sector_plan_sections(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  source_kind text NOT NULL CHECK (source_kind IN ('corpus_row','repo_file','research_url','user')),
  source_ref text NOT NULL,
  label text NOT NULL,
  excerpt text,
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sector_plan_citations_section_idx ON public.sector_plan_citations (section_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sector_plan_citations TO authenticated;
GRANT ALL ON public.sector_plan_citations TO service_role;
ALTER TABLE public.sector_plan_citations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "country access sector plan citations" ON public.sector_plan_citations;
CREATE POLICY "country access sector plan citations" ON public.sector_plan_citations FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE TABLE IF NOT EXISTS public.sector_plan_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.sector_plans(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  reason text NOT NULL,
  taken_at timestamptz NOT NULL DEFAULT now(),
  sections jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS sector_plan_snapshots_plan_idx ON public.sector_plan_snapshots (plan_id, taken_at DESC);
GRANT SELECT, INSERT ON public.sector_plan_snapshots TO authenticated;
GRANT ALL ON public.sector_plan_snapshots TO service_role;
ALTER TABLE public.sector_plan_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "country access sector plan snapshots" ON public.sector_plan_snapshots;
CREATE POLICY "country access sector plan snapshots" ON public.sector_plan_snapshots FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

-- ---------------------------------------------------------------- 4 governance

CREATE OR REPLACE FUNCTION public.sector_plans_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  changed boolean;
  sector_label text;
  horizon integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF actor IS NOT NULL AND OLD.status NOT IN ('draft','superseded') THEN
      RAISE EXCEPTION 'Only a draft or superseded plan can be deleted. Withdraw it first.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF actor IS NOT NULL THEN
      NEW.status := 'draft';
      IF NOT EXISTS (SELECT 1 FROM public.sector_priorities p
                     WHERE p.country_code = NEW.country_code AND p.sector_code = NEW.sector_code
                       AND p.status = 'priority') THEN
        RAISE EXCEPTION 'Choose this sector as a national priority before writing its plan.';
      END IF;
    END IF;
    NEW.created_by := COALESCE(actor, NEW.created_by);
    NEW.version := COALESCE((SELECT max(version) FROM public.sector_plans
                             WHERE country_code = NEW.country_code AND sector_code = NEW.sector_code), 0) + 1;
    NEW.submitted_by := NULL; NEW.submitted_at := NULL;
    NEW.approved_by := NULL; NEW.approved_at := NULL; NEW.approval_mode := NULL;
    NEW.returned_by := NULL; NEW.returned_at := NULL; NEW.returned_note := NULL;
    NEW.commitment_id := NULL;
    RETURN NEW;
  END IF;

  IF NEW.country_code IS DISTINCT FROM OLD.country_code OR NEW.sector_code IS DISTINCT FROM OLD.sector_code THEN
    RAISE EXCEPTION 'A plan cannot be moved to another country or sector.';
  END IF;
  NEW.updated_at := now();
  IF actor IS NULL THEN RETURN NEW; END IF;

  changed := (NEW.title, NEW.scope) IS DISTINCT FROM (OLD.title, OLD.scope);

  -- Governance columns are never client-writable.
  NEW.created_by := OLD.created_by; NEW.version := OLD.version;
  NEW.submitted_by := OLD.submitted_by; NEW.submitted_at := OLD.submitted_at;
  NEW.approved_by := OLD.approved_by; NEW.approved_at := OLD.approved_at;
  NEW.approval_mode := OLD.approval_mode; NEW.commitment_id := OLD.commitment_id;
  NEW.returned_by := OLD.returned_by; NEW.returned_at := OLD.returned_at;
  IF NOT (NEW.status = 'returned' AND OLD.status = 'submitted') THEN
    NEW.returned_note := OLD.returned_note;
  END IF;

  IF NEW.status = OLD.status THEN
    IF changed AND OLD.status IN ('submitted','approved') THEN
      NEW.status := 'draft';
      NEW.submitted_by := NULL; NEW.submitted_at := NULL;
      NEW.approved_by := NULL; NEW.approved_at := NULL; NEW.approval_mode := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status IN ('draft','returned') AND NEW.status = 'submitted' THEN
    IF EXISTS (SELECT 1 FROM public.sector_plan_sections s WHERE s.plan_id = NEW.id AND s.status = 'pending') THEN
      RAISE EXCEPTION 'Every section must be drafted before the plan is submitted for approval.';
    END IF;
    NEW.submitted_by := actor; NEW.submitted_at := now();
    NEW.returned_by := NULL; NEW.returned_at := NULL;

  ELSIF OLD.status = 'submitted' AND NEW.status = 'approved' THEN
    IF changed THEN RAISE EXCEPTION 'Approving cannot change the plan. Return it with a note instead.'; END IF;
    IF NOT public.can_approve_sector(actor, OLD.country_code) THEN
      RAISE EXCEPTION 'You do not hold an approver role for this country.';
    END IF;
    IF actor = OLD.submitted_by THEN
      IF NOT public.can_sole_approve_sector(actor, OLD.country_code) THEN
        RAISE EXCEPTION 'Two-person rule: the person who submitted this plan cannot approve it.';
      END IF;
      NEW.approval_mode := 'sole_admin';
    ELSE
      NEW.approval_mode := 'two_person';
    END IF;
    IF EXISTS (SELECT 1 FROM public.sector_plan_sections s WHERE s.plan_id = NEW.id AND s.status = 'stale') THEN
      RAISE EXCEPTION 'A section is out of date with the corpus. Refresh it before approval.';
    END IF;
    NEW.approved_by := actor; NEW.approved_at := now();
    UPDATE public.sector_plans SET status = 'superseded'
      WHERE country_code = NEW.country_code AND sector_code = NEW.sector_code
        AND status = 'approved' AND id <> NEW.id;

    -- Approval is a Cabinet commitment to deliver the plan.
    SELECT label INTO sector_label FROM public.sectors WHERE code = NEW.sector_code;
    horizon := LEAST(GREATEST(COALESCE(NULLIF(NEW.scope->>'horizon_years','')::integer, 5), 1), 15);
    INSERT INTO public.commitments (country_code, title, due_at, status, created_by, success_metric, sector_code)
    VALUES (NEW.country_code,
            'Deliver the ' || COALESCE(sector_label, NEW.sector_code) || ' Sector Development Plan (v' || NEW.version || ')',
            now() + make_interval(years => horizon),
            'open', actor,
            'The targets in the plan''s Sector Compact, reviewed quarterly by the Head of Government.',
            NEW.sector_code)
    RETURNING id INTO NEW.commitment_id;

  ELSIF OLD.status = 'submitted' AND NEW.status = 'returned' THEN
    IF changed THEN RAISE EXCEPTION 'Returning cannot change the plan.'; END IF;
    IF actor = OLD.submitted_by OR NOT public.can_approve_sector(actor, OLD.country_code) THEN
      RAISE EXCEPTION 'Only an approver other than the submitter can return a plan.';
    END IF;
    IF COALESCE(btrim(NEW.returned_note), '') = '' THEN
      RAISE EXCEPTION 'Say what needs to change when returning a plan.';
    END IF;
    NEW.returned_by := actor; NEW.returned_at := now();

  ELSIF OLD.status = 'submitted' AND NEW.status = 'draft' THEN
    IF actor <> OLD.submitted_by AND NOT public.can_approve_sector(actor, OLD.country_code) THEN
      RAISE EXCEPTION 'Only the submitter or an approver can withdraw a plan.';
    END IF;
    NEW.submitted_by := NULL; NEW.submitted_at := NULL;

  ELSIF OLD.status = 'approved' AND NEW.status = 'draft' THEN
    IF NOT public.can_approve_sector(actor, OLD.country_code) THEN
      RAISE EXCEPTION 'Only an approver can reopen an approved plan.';
    END IF;
    NEW.submitted_by := NULL; NEW.submitted_at := NULL;
    NEW.approved_by := NULL; NEW.approved_at := NULL; NEW.approval_mode := NULL;

  ELSIF OLD.status = 'approved' AND NEW.status = 'superseded' THEN
    NULL;

  ELSE
    RAISE EXCEPTION 'A plan cannot move from % to %.', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sector_plans_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  act text;
  r record;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  IF TG_OP = 'INSERT' THEN act := 'sector_plan.created';
  ELSIF TG_OP = 'DELETE' THEN act := 'sector_plan.deleted';
  ELSIF NEW.status <> OLD.status THEN
    act := CASE
      WHEN NEW.status = 'submitted' THEN 'sector_plan.submitted'
      WHEN NEW.status = 'approved' THEN 'sector_plan.approved'
      WHEN NEW.status = 'returned' THEN 'sector_plan.returned'
      WHEN NEW.status = 'superseded' THEN 'sector_plan.superseded'
      WHEN OLD.status = 'submitted' THEN 'sector_plan.withdrawn'
      ELSE 'sector_plan.reopened' END;
  ELSIF (NEW.title, NEW.scope) IS DISTINCT FROM (OLD.title, OLD.scope) THEN
    act := 'sector_plan.edited';
  ELSE RETURN NULL;
  END IF;
  PERFORM public.log_governance(act, 'sector_plan', r.id::text, r.country_code,
    jsonb_build_object(
      'title', r.title,
      'sector', r.sector_code,
      'from', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END,
      'to', CASE WHEN TG_OP <> 'DELETE' THEN NEW.status END,
      'version', r.version,
      'mode', CASE WHEN act = 'sector_plan.approved' THEN NEW.approval_mode END,
      'commitment', CASE WHEN act = 'sector_plan.approved' THEN NEW.commitment_id END,
      'note', CASE WHEN act = 'sector_plan.returned' THEN NEW.returned_note END));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sector_plans_guard ON public.sector_plans;
CREATE TRIGGER sector_plans_guard BEFORE INSERT OR UPDATE OR DELETE ON public.sector_plans
  FOR EACH ROW EXECUTE FUNCTION public.sector_plans_guard();
DROP TRIGGER IF EXISTS sector_plans_history ON public.sector_plans;
CREATE TRIGGER sector_plans_history AFTER INSERT OR UPDATE OR DELETE ON public.sector_plans
  FOR EACH ROW EXECUTE FUNCTION public.sector_plans_history();

-- A section edit on a submitted or approved plan reopens it, and records who edited.
CREATE OR REPLACE FUNCTION public.sector_plan_sections_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  parent public.sector_plans;
BEGIN
  SELECT * INTO parent FROM public.sector_plans WHERE id = NEW.plan_id;
  IF parent.id IS NULL THEN RAISE EXCEPTION 'Unknown plan.'; END IF;
  NEW.country_code := parent.country_code;
  IF TG_OP = 'UPDATE' AND actor IS NOT NULL THEN
    IF NEW.body_md IS DISTINCT FROM OLD.body_md THEN
      NEW.edited_by := actor; NEW.edited_at := now();
      IF NEW.status NOT IN ('gap','pending') THEN NEW.status := 'edited'; END IF;
      IF parent.status IN ('submitted','approved') THEN
        UPDATE public.sector_plans SET status = 'draft', submitted_by = NULL, submitted_at = NULL,
          approved_by = NULL, approved_at = NULL, approval_mode = NULL WHERE id = parent.id;
        PERFORM public.log_governance('sector_plan.reopened', 'sector_plan', parent.id::text, parent.country_code,
          jsonb_build_object('title', parent.title, 'from', parent.status, 'to', 'draft',
                             'version', parent.version, 'section', NEW.stage_key));
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sector_plan_sections_guard ON public.sector_plan_sections;
CREATE TRIGGER sector_plan_sections_guard BEFORE INSERT OR UPDATE ON public.sector_plan_sections
  FOR EACH ROW EXECUTE FUNCTION public.sector_plan_sections_guard();
