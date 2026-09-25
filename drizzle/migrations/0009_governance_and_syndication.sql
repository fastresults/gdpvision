-- 0009 · Governance and syndication
--
-- Moves the rules the standards audit and investment pipeline depend on out of
-- server functions and into the database, where a direct API call cannot skip
-- them, and adds the tables for investor packages, share links, investor
-- tracking, AI-suggested standard mappings and monthly audit snapshots.
--
--   1. Capability helpers: who may approve, who may see compliance data.
--   2. Collection plans: status machine, two-person rule, edit reopens approval.
--   3. Investment projects: readiness in SQL, submit/approve/return, edit reopens.
--   4. Compliance (beneficial owners, AML) split into a restricted table.
--   5. Governance history written by trigger to audit_log, read via a function.
--   6. Standard mappings, audit snapshots.
--   7. Share links, views, investors, interest, packages.
--
-- Every write path through the service role (auth.uid() IS NULL) skips the
-- actor checks but is still recorded in the history.

-- ---------------------------------------------------------------- 1 helpers

CREATE OR REPLACE FUNCTION public.has_country_role(_user_id uuid, _country_code text, _roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'::public.app_role AND country_code IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND country_code = _country_code AND role = ANY(_roles)
  );
$$;

-- Edit these three lists to change who holds each capability.
CREATE OR REPLACE FUNCTION public.can_approve_protocol(_user_id uuid, _country_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_country_role(_user_id, _country_code,
    ARRAY['country_admin','data_steward','cabinet_secretary']::public.app_role[]);
$$;

CREATE OR REPLACE FUNCTION public.can_approve_investment(_user_id uuid, _country_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_country_role(_user_id, _country_code,
    ARRAY['country_admin','cabinet_secretary','principal']::public.app_role[]);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_compliance(_user_id uuid, _country_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_country_role(_user_id, _country_code,
    ARRAY['country_admin','cabinet_secretary']::public.app_role[]);
$$;

REVOKE EXECUTE ON FUNCTION public.has_country_role(uuid, text, public.app_role[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_approve_protocol(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_approve_investment(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_compliance(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_country_role(uuid, text, public.app_role[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_approve_protocol(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_approve_investment(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_compliance(uuid, text) TO authenticated, service_role;

-- History writer. SECURITY DEFINER because authenticated has no INSERT on
-- audit_log — which is why the 0008 server functions' audit inserts silently
-- failed.
CREATE OR REPLACE FUNCTION public.log_governance(_action text, _target_type text, _target_id text, _scope text, _meta jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.audit_log (actor_id, action, target_type, target_id, scope_key, metadata)
  VALUES (auth.uid(), _action, _target_type, _target_id, _scope, COALESCE(_meta, '{}'::jsonb));
$$;
REVOKE EXECUTE ON FUNCTION public.log_governance(text, text, text, text, jsonb) FROM anon, public, authenticated;

-- History reader for country users (audit_log itself is admin-read only).
CREATE OR REPLACE FUNCTION public.governance_history(_target_type text, _target_id text)
RETURNS TABLE (id uuid, action text, actor_id uuid, actor_label text, metadata jsonb, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.action, a.actor_id,
         COALESCE(a.actor_label, p.display_name) AS actor_label,
         a.metadata, a.created_at
  FROM public.audit_log a
  LEFT JOIN public.profiles p ON p.id = a.actor_id
  WHERE a.target_type = _target_type
    AND a.target_id = _target_id
    AND public.has_country_access(auth.uid(), a.scope_key)
  ORDER BY a.created_at DESC
  LIMIT 200;
$$;
REVOKE EXECUTE ON FUNCTION public.governance_history(text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.governance_history(text, text) TO authenticated;

-- ---------------------------------------------------------------- 2 collection plans

ALTER TABLE public.collection_protocols
  ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS returned_by uuid,
  ADD COLUMN IF NOT EXISTS returned_at timestamptz,
  ADD COLUMN IF NOT EXISTS returned_note text;

UPDATE public.collection_protocols SET status = 'draft' WHERE status NOT IN ('draft','submitted','approved','returned');
ALTER TABLE public.collection_protocols DROP CONSTRAINT IF EXISTS collection_protocols_status_check;
ALTER TABLE public.collection_protocols ADD CONSTRAINT collection_protocols_status_check
  CHECK (status IN ('draft','submitted','approved','returned'));

CREATE OR REPLACE FUNCTION public.collection_protocols_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  changed boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF actor IS NOT NULL AND OLD.status <> 'draft' THEN
      RAISE EXCEPTION 'Only a draft plan can be deleted. Withdraw or revise it first.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF actor IS NOT NULL AND NEW.status NOT IN ('draft','submitted') THEN
      RAISE EXCEPTION 'A new plan starts as a draft or is submitted for approval.';
    END IF;
    NEW.created_by := COALESCE(actor, NEW.created_by);
    NEW.version := 1;
    NEW.approved_by := NULL; NEW.approved_at := NULL;
    NEW.returned_by := NULL; NEW.returned_at := NULL; NEW.returned_note := NULL;
    IF NEW.status = 'submitted' THEN
      NEW.submitted_by := COALESCE(actor, NEW.submitted_by); NEW.submitted_at := now();
    ELSE
      NEW.submitted_by := NULL; NEW.submitted_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.country_code IS DISTINCT FROM OLD.country_code OR NEW.requirement_id IS DISTINCT FROM OLD.requirement_id THEN
    RAISE EXCEPTION 'A plan cannot be moved to another country or requirement.';
  END IF;
  IF actor IS NULL THEN RETURN NEW; END IF;

  changed := (NEW.owner_agency, NEW.method, NEW.cadence, NEW.validation_rules, NEW.due_date, NEW.notes)
    IS DISTINCT FROM (OLD.owner_agency, OLD.method, OLD.cadence, OLD.validation_rules, OLD.due_date, OLD.notes);

  -- Governance columns are never client-writable; restore them, then apply the transition.
  NEW.created_by := OLD.created_by; NEW.version := OLD.version;
  NEW.submitted_by := OLD.submitted_by; NEW.submitted_at := OLD.submitted_at;
  NEW.approved_by := OLD.approved_by; NEW.approved_at := OLD.approved_at;
  NEW.returned_by := OLD.returned_by; NEW.returned_at := OLD.returned_at;
  IF NEW.status = 'returned' AND OLD.status = 'submitted' THEN
    NULL; -- returned_note is supplied by the approver
  ELSE
    NEW.returned_note := OLD.returned_note;
  END IF;

  IF NEW.status = OLD.status THEN
    IF changed AND OLD.status IN ('submitted','approved') THEN
      -- Editing a plan under review or already approved sends it back to draft.
      NEW.status := 'draft';
      NEW.version := OLD.version + 1;
      NEW.submitted_by := NULL; NEW.submitted_at := NULL;
      NEW.approved_by := NULL; NEW.approved_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status IN ('draft','returned') AND NEW.status = 'submitted' THEN
    NEW.submitted_by := actor; NEW.submitted_at := now();
    NEW.returned_by := NULL; NEW.returned_at := NULL;
    IF changed AND OLD.status = 'returned' THEN NEW.version := OLD.version + 1; END IF;

  ELSIF OLD.status = 'submitted' AND NEW.status = 'approved' THEN
    IF changed THEN
      RAISE EXCEPTION 'Approving cannot change the plan. Return it with a note instead.';
    END IF;
    IF actor = OLD.submitted_by THEN
      RAISE EXCEPTION 'Two-person rule: the person who submitted this plan cannot approve it.';
    END IF;
    IF NOT public.can_approve_protocol(actor, OLD.country_code) THEN
      RAISE EXCEPTION 'You do not hold an approver role for this country.';
    END IF;
    NEW.approved_by := actor; NEW.approved_at := now();

  ELSIF OLD.status = 'submitted' AND NEW.status = 'returned' THEN
    IF changed THEN
      RAISE EXCEPTION 'Returning cannot change the plan.';
    END IF;
    IF actor = OLD.submitted_by OR NOT public.can_approve_protocol(actor, OLD.country_code) THEN
      RAISE EXCEPTION 'Only an approver other than the submitter can return a plan.';
    END IF;
    IF COALESCE(btrim(NEW.returned_note), '') = '' THEN
      RAISE EXCEPTION 'Say what needs to change when returning a plan.';
    END IF;
    NEW.returned_by := actor; NEW.returned_at := now();

  ELSIF OLD.status = 'submitted' AND NEW.status = 'draft' THEN
    IF actor <> OLD.submitted_by AND NOT public.can_approve_protocol(actor, OLD.country_code) THEN
      RAISE EXCEPTION 'Only the submitter or an approver can withdraw a plan.';
    END IF;
    NEW.submitted_by := NULL; NEW.submitted_at := NULL;

  ELSIF OLD.status = 'approved' AND NEW.status = 'draft' THEN
    NEW.version := OLD.version + 1;
    NEW.submitted_by := NULL; NEW.submitted_at := NULL;
    NEW.approved_by := NULL; NEW.approved_at := NULL;

  ELSE
    RAISE EXCEPTION 'A plan cannot move from % to %.', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.collection_protocols_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  act text;
  r record;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    act := CASE WHEN NEW.status = 'submitted' THEN 'protocol.submitted' ELSE 'protocol.created' END;
  ELSIF TG_OP = 'DELETE' THEN
    act := 'protocol.deleted';
  ELSIF NEW.status <> OLD.status THEN
    act := CASE
      WHEN NEW.status = 'submitted' THEN 'protocol.submitted'
      WHEN NEW.status = 'approved' THEN 'protocol.approved'
      WHEN NEW.status = 'returned' THEN 'protocol.returned'
      WHEN OLD.status = 'submitted' AND NEW.version = OLD.version THEN 'protocol.withdrawn'
      ELSE 'protocol.reopened' END;
  ELSE
    act := 'protocol.edited';
  END IF;
  PERFORM public.log_governance(act, 'collection_protocol', r.id::text, r.country_code,
    jsonb_build_object(
      'requirement_id', r.requirement_id,
      'from', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status END,
      'to', CASE WHEN TG_OP <> 'DELETE' THEN NEW.status END,
      'version', r.version,
      'note', CASE WHEN act = 'protocol.returned' THEN NEW.returned_note END));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS collection_protocols_guard ON public.collection_protocols;
CREATE TRIGGER collection_protocols_guard BEFORE INSERT OR UPDATE OR DELETE ON public.collection_protocols
  FOR EACH ROW EXECUTE FUNCTION public.collection_protocols_guard();
DROP TRIGGER IF EXISTS collection_protocols_history ON public.collection_protocols;
CREATE TRIGGER collection_protocols_history AFTER INSERT OR UPDATE OR DELETE ON public.collection_protocols
  FOR EACH ROW EXECUTE FUNCTION public.collection_protocols_history();

-- ---------------------------------------------------------------- 3 investment projects

ALTER TABLE public.investment_projects
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS bo_disclosed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS submitted_by uuid,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS returned_by uuid,
  ADD COLUMN IF NOT EXISTS returned_at timestamptz,
  ADD COLUMN IF NOT EXISTS returned_note text;

-- Normalise the free text 0008 allowed, so the new constraints hold for every row.
UPDATE public.investment_projects
   SET es_category = CASE
         WHEN es_category IS NULL THEN NULL
         WHEN upper(btrim(es_category)) ~ '^(CATEGORY\s*)?(FI)$' THEN 'FI'
         WHEN upper(btrim(es_category)) ~ '^(CATEGORY\s*)?[ABC]$' THEN right(upper(btrim(es_category)), 1)
         ELSE NULL END,
       stage = CASE
         WHEN regexp_replace(lower(btrim(stage)), '[\s-]+', '_', 'g') IN
              ('concept','pre_feasibility','feasibility','structuring','tender','financing','construction','operation')
           THEN regexp_replace(lower(btrim(stage)), '[\s-]+', '_', 'g')
         ELSE 'concept' END,
       approval_status = CASE WHEN approval_status IN ('draft','submitted','approved','returned','withdrawn')
         THEN approval_status ELSE 'draft' END;

ALTER TABLE public.investment_projects DROP CONSTRAINT IF EXISTS investment_projects_es_category_check;
ALTER TABLE public.investment_projects ADD CONSTRAINT investment_projects_es_category_check
  CHECK (es_category IS NULL OR es_category IN ('A','B','C','FI'));
ALTER TABLE public.investment_projects DROP CONSTRAINT IF EXISTS investment_projects_stage_check;
ALTER TABLE public.investment_projects ADD CONSTRAINT investment_projects_stage_check
  CHECK (stage IN ('concept','pre_feasibility','feasibility','structuring','tender','financing','construction','operation'));
ALTER TABLE public.investment_projects DROP CONSTRAINT IF EXISTS investment_projects_approval_status_check;
ALTER TABLE public.investment_projects ADD CONSTRAINT investment_projects_approval_status_check
  CHECK (approval_status IN ('draft','submitted','approved','returned','withdrawn'));

-- A field counts as filled only if it says something. Mirrors hasContent() in
-- src/lib/investments/readiness.ts — change both together.
CREATE OR REPLACE FUNCTION public.gdpv_has_content(_v text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT _v IS NOT NULL
     AND length(btrim(_v)) >= 3
     AND lower(btrim(_v)) NOT IN ('n/a','na','none','tbd','tba','todo','unknown','pending','---');
$$;

-- Mirrors readinessChecks() in src/lib/investments/readiness.ts — change both together.
CREATE OR REPLACE FUNCTION public.investment_readiness(p public.investment_projects)
RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT
      (public.gdpv_has_content(p.sector) AND public.gdpv_has_content(p.structure)
         AND COALESCE(p.capex_usd, 0) > 0 AND public.gdpv_has_content(p.summary))::int
    + public.gdpv_has_content(p.revenue_model)::int
    + public.gdpv_has_content(p.sponsor)::int
    + COALESCE(p.bo_disclosed, false)::int
    + COALESCE(p.aml_cleared, false)::int
    + (p.es_category IN ('A','B','C','FI'))::int
    + public.gdpv_has_content(p.climate_alignment)::int
    + public.gdpv_has_content(p.risks)::int
    + COALESCE(p.feasibility_done, false)::int
    + COALESCE(p.land_secured, false)::int;
$$;

CREATE OR REPLACE FUNCTION public.investment_projects_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  syncing boolean := COALESCE(current_setting('gdpv.compliance_sync', true), '') = 'on';
  changed boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF actor IS NOT NULL AND OLD.approval_status IN ('submitted','approved') THEN
      RAISE EXCEPTION 'An approved or submitted project cannot be deleted. Withdraw it first.';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.beneficial_owners IS NOT NULL AND actor IS NOT NULL THEN
    RAISE EXCEPTION 'Beneficial owners are recorded in the restricted compliance record, not on the project.';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF actor IS NOT NULL THEN
      NEW.created_by := actor;
      NEW.approval_status := 'draft';
      NEW.aml_cleared := false; NEW.bo_disclosed := false;
    END IF;
    NEW.version := 1;
    NEW.approved_by := NULL; NEW.approved_at := NULL;
    NEW.submitted_by := NULL; NEW.submitted_at := NULL;
    NEW.returned_by := NULL; NEW.returned_at := NULL; NEW.returned_note := NULL;
    RETURN NEW;
  END IF;

  IF NEW.country_code IS DISTINCT FROM OLD.country_code THEN
    RAISE EXCEPTION 'A project cannot be moved to another country.';
  END IF;
  IF actor IS NULL THEN RETURN NEW; END IF;

  IF NOT syncing AND (NEW.aml_cleared, NEW.bo_disclosed) IS DISTINCT FROM (OLD.aml_cleared, OLD.bo_disclosed) THEN
    RAISE EXCEPTION 'AML clearance and beneficial-owner disclosure are set from the compliance record.';
  END IF;

  changed := (NEW.title, NEW.sector, NEW.structure, NEW.stage, NEW.capex_usd, NEW.revenue_model, NEW.sponsor,
              NEW.es_category, NEW.summary, NEW.risks, NEW.climate_alignment, NEW.aml_cleared, NEW.bo_disclosed,
              NEW.feasibility_done, NEW.land_secured)
    IS DISTINCT FROM
             (OLD.title, OLD.sector, OLD.structure, OLD.stage, OLD.capex_usd, OLD.revenue_model, OLD.sponsor,
              OLD.es_category, OLD.summary, OLD.risks, OLD.climate_alignment, OLD.aml_cleared, OLD.bo_disclosed,
              OLD.feasibility_done, OLD.land_secured);

  NEW.created_by := OLD.created_by; NEW.version := OLD.version;
  NEW.submitted_by := OLD.submitted_by; NEW.submitted_at := OLD.submitted_at;
  NEW.approved_by := OLD.approved_by; NEW.approved_at := OLD.approved_at;
  NEW.returned_by := OLD.returned_by; NEW.returned_at := OLD.returned_at;
  IF NOT (NEW.approval_status = 'returned' AND OLD.approval_status = 'submitted') THEN
    NEW.returned_note := OLD.returned_note;
  END IF;

  IF changed THEN NEW.version := OLD.version + 1; END IF;

  IF NEW.approval_status = OLD.approval_status THEN
    IF changed AND OLD.approval_status IN ('submitted','approved') THEN
      -- Any material edit reopens approval; share links pause until it is re-approved.
      NEW.approval_status := 'draft';
      NEW.submitted_by := NULL; NEW.submitted_at := NULL;
      NEW.approved_by := NULL; NEW.approved_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.approval_status IN ('draft','returned','withdrawn') AND NEW.approval_status = 'submitted' THEN
    IF public.investment_readiness(NEW) < 10 THEN
      RAISE EXCEPTION 'All ten readiness checks must pass before a project is submitted for approval.';
    END IF;
    NEW.submitted_by := actor; NEW.submitted_at := now();
    NEW.returned_by := NULL; NEW.returned_at := NULL;

  ELSIF OLD.approval_status = 'submitted' AND NEW.approval_status = 'approved' THEN
    IF changed THEN RAISE EXCEPTION 'Approving cannot change the project. Return it with a note instead.'; END IF;
    IF actor = OLD.submitted_by THEN
      RAISE EXCEPTION 'Two-person rule: the person who submitted this project cannot approve it.';
    END IF;
    IF NOT public.can_approve_investment(actor, OLD.country_code) THEN
      RAISE EXCEPTION 'You do not hold an approver role for investments in this country.';
    END IF;
    IF public.investment_readiness(NEW) < 10 THEN
      RAISE EXCEPTION 'All ten readiness checks must pass before approval.';
    END IF;
    NEW.approved_by := actor; NEW.approved_at := now();

  ELSIF OLD.approval_status = 'submitted' AND NEW.approval_status = 'returned' THEN
    IF changed THEN RAISE EXCEPTION 'Returning cannot change the project.'; END IF;
    IF actor = OLD.submitted_by OR NOT public.can_approve_investment(actor, OLD.country_code) THEN
      RAISE EXCEPTION 'Only an approver other than the submitter can return a project.';
    END IF;
    IF COALESCE(btrim(NEW.returned_note), '') = '' THEN
      RAISE EXCEPTION 'Say what needs to change when returning a project.';
    END IF;
    NEW.returned_by := actor; NEW.returned_at := now();

  ELSIF OLD.approval_status = 'submitted' AND NEW.approval_status = 'draft' THEN
    IF actor <> OLD.submitted_by AND NOT public.can_approve_investment(actor, OLD.country_code) THEN
      RAISE EXCEPTION 'Only the submitter or an approver can withdraw a submission.';
    END IF;
    NEW.submitted_by := NULL; NEW.submitted_at := NULL;

  ELSIF OLD.approval_status = 'approved' AND NEW.approval_status IN ('withdrawn','draft') THEN
    IF NOT public.can_approve_investment(actor, OLD.country_code) THEN
      RAISE EXCEPTION 'Only an investment approver can take an approved project off the market.';
    END IF;
    NEW.submitted_by := NULL; NEW.submitted_at := NULL;
    NEW.approved_by := NULL; NEW.approved_at := NULL;

  ELSE
    RAISE EXCEPTION 'A project cannot move from % to %.', OLD.approval_status, NEW.approval_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.investment_projects_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  act text;
  r record;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  IF TG_OP = 'INSERT' THEN act := 'investment.created';
  ELSIF TG_OP = 'DELETE' THEN act := 'investment.deleted';
  ELSIF NEW.approval_status <> OLD.approval_status THEN
    act := CASE
      WHEN NEW.approval_status = 'submitted' THEN 'investment.submitted'
      WHEN NEW.approval_status = 'approved' THEN 'investment.approved'
      WHEN NEW.approval_status = 'returned' THEN 'investment.returned'
      WHEN NEW.approval_status = 'withdrawn' THEN 'investment.withdrawn'
      WHEN NEW.version > OLD.version THEN 'investment.reopened'
      ELSE 'investment.withdrawn' END;
  ELSIF NEW.version > OLD.version THEN act := 'investment.edited';
  ELSE RETURN NULL;
  END IF;
  PERFORM public.log_governance(act, 'investment_project', r.id::text, r.country_code,
    jsonb_build_object(
      'title', r.title,
      'from', CASE WHEN TG_OP = 'UPDATE' THEN OLD.approval_status END,
      'to', CASE WHEN TG_OP <> 'DELETE' THEN NEW.approval_status END,
      'version', r.version,
      'readiness', CASE WHEN TG_OP <> 'DELETE' THEN public.investment_readiness(NEW) END,
      'note', CASE WHEN act = 'investment.returned' THEN NEW.returned_note END));
  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------- 4 compliance

CREATE TABLE IF NOT EXISTS public.investment_project_compliance (
  project_id uuid PRIMARY KEY REFERENCES public.investment_projects(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  -- [{ "name": text, "nationality": text?, "ownership_pct": number?, "is_pep": bool?, "evidence": text? }]
  beneficial_owners jsonb NOT NULL DEFAULT '[]'::jsonb,
  aml_status text NOT NULL DEFAULT 'not_started'
    CHECK (aml_status IN ('not_started','in_progress','cleared','failed')),
  aml_reference text,
  aml_cleared_by uuid,
  aml_cleared_at timestamptz,
  notes text,
  updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_project_compliance TO authenticated;
GRANT ALL ON public.investment_project_compliance TO service_role;
ALTER TABLE public.investment_project_compliance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "compliance officers" ON public.investment_project_compliance;
CREATE POLICY "compliance officers" ON public.investment_project_compliance FOR ALL TO authenticated
  USING (public.can_manage_compliance(auth.uid(), country_code))
  WITH CHECK (public.can_manage_compliance(auth.uid(), country_code));

CREATE OR REPLACE FUNCTION public.investment_compliance_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  proj public.investment_projects;
BEGIN
  SELECT * INTO proj FROM public.investment_projects WHERE id = NEW.project_id;
  IF proj.id IS NULL THEN RAISE EXCEPTION 'Unknown project.'; END IF;
  NEW.country_code := proj.country_code;
  NEW.updated_by := COALESCE(actor, NEW.updated_by);
  IF jsonb_typeof(NEW.beneficial_owners) <> 'array' THEN
    RAISE EXCEPTION 'Beneficial owners must be a list.';
  END IF;

  IF NEW.aml_status = 'cleared' AND (TG_OP = 'INSERT' OR OLD.aml_status IS DISTINCT FROM 'cleared') THEN
    IF actor IS NOT NULL AND actor = proj.created_by THEN
      RAISE EXCEPTION 'Two-person rule: the person who entered the project cannot clear its AML due diligence.';
    END IF;
    IF COALESCE(btrim(NEW.aml_reference), '') = '' THEN
      RAISE EXCEPTION 'Record the due-diligence reference when clearing AML.';
    END IF;
    NEW.aml_cleared_by := actor; NEW.aml_cleared_at := now();
  ELSIF NEW.aml_status <> 'cleared' THEN
    NEW.aml_cleared_by := NULL; NEW.aml_cleared_at := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.aml_cleared_by := OLD.aml_cleared_by; NEW.aml_cleared_at := OLD.aml_cleared_at;
  END IF;
  RETURN NEW;
END;
$$;

-- Push the two booleans onto the project so readiness is computable by anyone
-- with country access, without exposing the names behind them.
CREATE OR REPLACE FUNCTION public.investment_compliance_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record;
  disclosed boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  IF TG_OP = 'DELETE' THEN
    disclosed := false;
  ELSE
    disclosed := jsonb_array_length(NEW.beneficial_owners) > 0 AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(NEW.beneficial_owners) e
      WHERE NOT public.gdpv_has_content(e->>'name'));
  END IF;
  PERFORM set_config('gdpv.compliance_sync', 'on', true);
  UPDATE public.investment_projects
     SET bo_disclosed = disclosed,
         aml_cleared = (TG_OP <> 'DELETE' AND NEW.aml_status = 'cleared')
   WHERE id = r.project_id
     AND (bo_disclosed, aml_cleared) IS DISTINCT FROM (disclosed, (TG_OP <> 'DELETE' AND NEW.aml_status = 'cleared'));
  PERFORM set_config('gdpv.compliance_sync', 'off', true);
  PERFORM public.log_governance('investment.compliance_updated', 'investment_project', r.project_id::text, r.country_code,
    jsonb_build_object('aml_status', CASE WHEN TG_OP <> 'DELETE' THEN NEW.aml_status END,
                       'owners_listed', CASE WHEN TG_OP <> 'DELETE' THEN jsonb_array_length(NEW.beneficial_owners) END));
  RETURN NULL;
END;
$$;

-- Move the free-text owners written by 0008 into the restricted table, then clear them.
INSERT INTO public.investment_project_compliance (project_id, country_code, beneficial_owners, aml_status, notes)
SELECT p.id, p.country_code,
       CASE WHEN public.gdpv_has_content(p.beneficial_owners)
            THEN jsonb_build_array(jsonb_build_object('name', p.beneficial_owners, 'legacy', true))
            ELSE '[]'::jsonb END,
       CASE WHEN p.aml_cleared THEN 'in_progress' ELSE 'not_started' END,
       CASE WHEN p.aml_cleared THEN 'Migrated: AML was ticked as cleared without a named reviewer or reference. Re-clear it.' END
FROM public.investment_projects p
ON CONFLICT (project_id) DO NOTHING;

-- Legacy approvals had no second person; send them back through the new flow.
UPDATE public.investment_projects
   SET beneficial_owners = NULL,
       aml_cleared = false,
       bo_disclosed = EXISTS (
         SELECT 1 FROM public.investment_project_compliance c
         WHERE c.project_id = investment_projects.id AND jsonb_array_length(c.beneficial_owners) > 0),
       approval_status = CASE WHEN approval_status = 'approved' THEN 'draft' ELSE approval_status END,
       approved_by = CASE WHEN approval_status = 'approved' THEN NULL ELSE approved_by END;

DROP TRIGGER IF EXISTS investment_projects_guard ON public.investment_projects;
CREATE TRIGGER investment_projects_guard BEFORE INSERT OR UPDATE OR DELETE ON public.investment_projects
  FOR EACH ROW EXECUTE FUNCTION public.investment_projects_guard();
DROP TRIGGER IF EXISTS investment_projects_history ON public.investment_projects;
CREATE TRIGGER investment_projects_history AFTER INSERT OR UPDATE OR DELETE ON public.investment_projects
  FOR EACH ROW EXECUTE FUNCTION public.investment_projects_history();
DROP TRIGGER IF EXISTS investment_compliance_guard ON public.investment_project_compliance;
CREATE TRIGGER investment_compliance_guard BEFORE INSERT OR UPDATE ON public.investment_project_compliance
  FOR EACH ROW EXECUTE FUNCTION public.investment_compliance_guard();
DROP TRIGGER IF EXISTS investment_compliance_sync ON public.investment_project_compliance;
CREATE TRIGGER investment_compliance_sync AFTER INSERT OR UPDATE OR DELETE ON public.investment_project_compliance
  FOR EACH ROW EXECUTE FUNCTION public.investment_compliance_sync();
DROP TRIGGER IF EXISTS investment_compliance_updated ON public.investment_project_compliance;
CREATE TRIGGER investment_compliance_updated BEFORE UPDATE ON public.investment_project_compliance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------- 6 mappings + snapshots

CREATE TABLE IF NOT EXISTS public.standard_kpi_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  requirement_id uuid NOT NULL REFERENCES public.standard_requirements(id) ON DELETE CASCADE,
  kpi_code text NOT NULL,
  status text NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','accepted','rejected')),
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  rationale text,
  suggested_by text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, requirement_id, kpi_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.standard_kpi_mappings TO authenticated;
GRANT ALL ON public.standard_kpi_mappings TO service_role;
ALTER TABLE public.standard_kpi_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "country access mappings" ON public.standard_kpi_mappings;
CREATE POLICY "country access mappings" ON public.standard_kpi_mappings FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

-- Accepting a mapping changes the audit score, so it is an approver's decision.
CREATE OR REPLACE FUNCTION public.standard_kpi_mappings_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid := auth.uid();
BEGIN
  IF actor IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'suggested' AND NOT public.can_approve_protocol(actor, NEW.country_code) THEN
      RAISE EXCEPTION 'Only an approver can add an accepted or rejected mapping.';
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT public.can_approve_protocol(actor, NEW.country_code) THEN
      RAISE EXCEPTION 'Only an approver can accept or reject a mapping.';
    END IF;
  END IF;
  IF NEW.status = 'suggested' THEN
    NEW.decided_by := NULL; NEW.decided_at := NULL;
  ELSIF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.decided_by := actor; NEW.decided_at := now();
  ELSE
    NEW.decided_by := OLD.decided_by; NEW.decided_at := OLD.decided_at;
  END IF;
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_governance('mapping.' || NEW.status, 'standard_kpi_mapping', NEW.id::text, NEW.country_code,
      jsonb_build_object('requirement_id', NEW.requirement_id, 'kpi_code', NEW.kpi_code, 'confidence', NEW.confidence));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS standard_kpi_mappings_guard ON public.standard_kpi_mappings;
CREATE TRIGGER standard_kpi_mappings_guard BEFORE INSERT OR UPDATE ON public.standard_kpi_mappings
  FOR EACH ROW EXECUTE FUNCTION public.standard_kpi_mappings_guard();

CREATE TABLE IF NOT EXISTS public.standards_audit_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  period_label text NOT NULL,           -- 'YYYY-MM', the month that just closed
  computed_at timestamptz NOT NULL DEFAULT now(),
  coverage_pct numeric NOT NULL,
  weighted_pct numeric NOT NULL,
  counts jsonb NOT NULL,                -- { collected, partial, stale, planned, missing }
  by_standard jsonb NOT NULL,           -- [{ code, met, total }]
  rows jsonb NOT NULL,                  -- [{ id, status }]
  UNIQUE (country_code, period_label)
);
GRANT SELECT ON public.standards_audit_snapshots TO authenticated;
GRANT ALL ON public.standards_audit_snapshots TO service_role;
ALTER TABLE public.standards_audit_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "country access snapshots" ON public.standards_audit_snapshots;
CREATE POLICY "country access snapshots" ON public.standards_audit_snapshots FOR SELECT TO authenticated
  USING (public.has_country_access(auth.uid(), country_code));

-- ---------------------------------------------------------------- 7 syndication

CREATE TABLE IF NOT EXISTS public.investment_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.investment_projects(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  token_hash text NOT NULL UNIQUE,       -- sha256(token), hex; the token itself is never stored
  token_hint text NOT NULL,              -- last 4 characters, for recognising a link in the list
  label text NOT NULL,                   -- who it was sent to, e.g. "IFC — infrastructure desk"
  allow_interest boolean NOT NULL DEFAULT true,
  include_packages text[] NOT NULL DEFAULT '{teaser}',
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
GRANT SELECT, INSERT, UPDATE ON public.investment_share_links TO authenticated;
GRANT ALL ON public.investment_share_links TO service_role;
ALTER TABLE public.investment_share_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read links" ON public.investment_share_links;
CREATE POLICY "read links" ON public.investment_share_links FOR SELECT TO authenticated
  USING (public.has_country_access(auth.uid(), country_code));
DROP POLICY IF EXISTS "approvers create links" ON public.investment_share_links;
CREATE POLICY "approvers create links" ON public.investment_share_links FOR INSERT TO authenticated
  WITH CHECK (public.can_approve_investment(auth.uid(), country_code));
DROP POLICY IF EXISTS "approvers revoke links" ON public.investment_share_links;
CREATE POLICY "approvers revoke links" ON public.investment_share_links FOR UPDATE TO authenticated
  USING (public.can_approve_investment(auth.uid(), country_code))
  WITH CHECK (public.can_approve_investment(auth.uid(), country_code));

CREATE OR REPLACE FUNCTION public.investment_share_links_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  proj public.investment_projects;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO proj FROM public.investment_projects WHERE id = NEW.project_id;
    IF proj.approval_status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'Only an approved project can be shared.';
    END IF;
    NEW.country_code := proj.country_code;
    NEW.created_by := COALESCE(actor, NEW.created_by);
    NEW.view_count := 0; NEW.last_viewed_at := NULL; NEW.revoked_at := NULL; NEW.revoked_by := NULL;
    PERFORM public.log_governance('share_link.created', 'investment_project', NEW.project_id::text, NEW.country_code,
      jsonb_build_object('label', NEW.label, 'expires_at', NEW.expires_at, 'hint', NEW.token_hint));
    RETURN NEW;
  END IF;
  IF actor IS NULL THEN RETURN NEW; END IF;
  -- Authenticated users may only revoke; everything else about a link is fixed.
  IF (NEW.project_id, NEW.country_code, NEW.token_hash, NEW.token_hint, NEW.label, NEW.allow_interest,
      NEW.include_packages, NEW.max_views, NEW.expires_at, NEW.view_count, NEW.last_viewed_at, NEW.created_by, NEW.created_at)
     IS DISTINCT FROM
     (OLD.project_id, OLD.country_code, OLD.token_hash, OLD.token_hint, OLD.label, OLD.allow_interest,
      OLD.include_packages, OLD.max_views, OLD.expires_at, OLD.view_count, OLD.last_viewed_at, OLD.created_by, OLD.created_at) THEN
    RAISE EXCEPTION 'A share link cannot be edited, only revoked. Create a new one instead.';
  END IF;
  IF OLD.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'This link is already revoked.';
  END IF;
  IF NEW.revoked_at IS NOT NULL THEN
    NEW.revoked_at := now(); NEW.revoked_by := actor;
    PERFORM public.log_governance('share_link.revoked', 'investment_project', NEW.project_id::text, NEW.country_code,
      jsonb_build_object('label', NEW.label, 'hint', NEW.token_hint));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS investment_share_links_guard ON public.investment_share_links;
CREATE TRIGGER investment_share_links_guard BEFORE INSERT OR UPDATE ON public.investment_share_links
  FOR EACH ROW EXECUTE FUNCTION public.investment_share_links_guard();

CREATE TABLE IF NOT EXISTS public.investment_share_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.investment_share_links(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  visitor_hash text,                    -- sha256(ip + link id); no raw IP is stored
  user_agent text,
  referrer text,
  event text NOT NULL DEFAULT 'view' CHECK (event IN ('view','package_open','interest'))
);
CREATE INDEX IF NOT EXISTS investment_share_views_link_idx ON public.investment_share_views (link_id, viewed_at DESC);
GRANT SELECT ON public.investment_share_views TO authenticated;
GRANT ALL ON public.investment_share_views TO service_role;
ALTER TABLE public.investment_share_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read views" ON public.investment_share_views;
CREATE POLICY "read views" ON public.investment_share_views FOR SELECT TO authenticated
  USING (public.has_country_access(auth.uid(), country_code));

CREATE TABLE IF NOT EXISTS public.investors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'other' CHECK (kind IN (
    'dfi','mdb','sovereign_fund','pension','infrastructure_fund','private_equity',
    'strategic','family_office','bank','other')),
  hq_country text,
  website text,
  contact_name text,
  contact_email text,
  ticket_min_usd numeric CHECK (ticket_min_usd IS NULL OR ticket_min_usd >= 0),
  ticket_max_usd numeric CHECK (ticket_max_usd IS NULL OR ticket_max_usd >= 0),
  sectors text[] NOT NULL DEFAULT '{}',
  kyc_status text NOT NULL DEFAULT 'not_started' CHECK (kyc_status IN ('not_started','in_progress','cleared','failed')),
  notes text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investors TO authenticated;
GRANT ALL ON public.investors TO service_role;
ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "country access investors" ON public.investors;
CREATE POLICY "country access investors" ON public.investors FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));
DROP TRIGGER IF EXISTS investors_updated ON public.investors;
CREATE TRIGGER investors_updated BEFORE UPDATE ON public.investors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- KYC is a compliance decision.
CREATE OR REPLACE FUNCTION public.investors_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.kyc_status IN ('cleared','failed')
     AND (TG_OP = 'INSERT' OR NEW.kyc_status IS DISTINCT FROM OLD.kyc_status)
     AND NOT public.can_manage_compliance(auth.uid(), NEW.country_code) THEN
    RAISE EXCEPTION 'Only a compliance officer can clear or fail an investor''s KYC.';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.kyc_status IS DISTINCT FROM OLD.kyc_status THEN
    PERFORM public.log_governance('investor.kyc', 'investor', NEW.id::text, NEW.country_code,
      jsonb_build_object('from', OLD.kyc_status, 'to', NEW.kyc_status, 'name', NEW.name));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS investors_guard ON public.investors;
CREATE TRIGGER investors_guard BEFORE INSERT OR UPDATE ON public.investors
  FOR EACH ROW EXECUTE FUNCTION public.investors_guard();

CREATE TABLE IF NOT EXISTS public.investor_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.investment_projects(id) ON DELETE CASCADE,
  investor_id uuid REFERENCES public.investors(id) ON DELETE SET NULL,
  share_link_id uuid REFERENCES public.investment_share_links(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','share_link')),
  stage text NOT NULL DEFAULT 'identified' CHECK (stage IN (
    'identified','contacted','nda_signed','data_room','due_diligence',
    'indicative_offer','term_sheet','closed_won','closed_lost')),
  indicative_amount_usd numeric CHECK (indicative_amount_usd IS NULL OR indicative_amount_usd >= 0),
  next_step text,
  next_step_due date,
  owner_id uuid,
  -- What an inbound enquirer told us, before they are matched to an investor record.
  contact_name text,
  contact_email text,
  organisation text,
  message text,
  nda_signed_at date,
  lost_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS investor_interests_project_investor_idx
  ON public.investor_interests (project_id, investor_id) WHERE investor_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_interests TO authenticated;
GRANT ALL ON public.investor_interests TO service_role;
ALTER TABLE public.investor_interests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "country access interests" ON public.investor_interests;
CREATE POLICY "country access interests" ON public.investor_interests FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

-- Stage gates: no data room without an NDA; no diligence or beyond without
-- a matched investor whose KYC is cleared.
CREATE OR REPLACE FUNCTION public.investor_interests_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ord text[] := ARRAY['identified','contacted','nda_signed','data_room','due_diligence','indicative_offer','term_sheet','closed_won'];
  pos integer;
  kyc text;
BEGIN
  NEW.country_code := (SELECT country_code FROM public.investment_projects WHERE id = NEW.project_id);
  IF NEW.stage = 'closed_lost' THEN
    IF COALESCE(btrim(NEW.lost_reason), '') = '' AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'Record why the opportunity was lost.';
    END IF;
  ELSE
    pos := array_position(ord, NEW.stage);
    IF pos >= 3 AND NEW.nda_signed_at IS NULL THEN
      RAISE EXCEPTION 'Record the NDA signature date before moving past "contacted".';
    END IF;
    IF pos >= 5 THEN
      IF NEW.investor_id IS NULL THEN
        RAISE EXCEPTION 'Match this enquiry to an investor record before due diligence.';
      END IF;
      SELECT kyc_status INTO kyc FROM public.investors WHERE id = NEW.investor_id;
      IF kyc IS DISTINCT FROM 'cleared' THEN
        RAISE EXCEPTION 'The investor''s KYC must be cleared before due diligence.';
      END IF;
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    IF NEW.stage IS DISTINCT FROM OLD.stage THEN
      PERFORM public.log_governance('interest.stage', 'investor_interest', NEW.id::text, NEW.country_code,
        jsonb_build_object('project_id', NEW.project_id, 'investor_id', NEW.investor_id, 'from', OLD.stage, 'to', NEW.stage));
    END IF;
  ELSE
    PERFORM public.log_governance('interest.created', 'investor_interest', NEW.id::text, NEW.country_code,
      jsonb_build_object('project_id', NEW.project_id, 'investor_id', NEW.investor_id, 'source', NEW.source, 'stage', NEW.stage));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS investor_interests_guard ON public.investor_interests;
CREATE TRIGGER investor_interests_guard BEFORE INSERT OR UPDATE ON public.investor_interests
  FOR EACH ROW EXECUTE FUNCTION public.investor_interests_guard();

CREATE TABLE IF NOT EXISTS public.investment_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.investment_projects(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('teaser','memorandum','data_room','deck')),
  version integer NOT NULL,
  project_version integer NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','superseded')),
  content jsonb NOT NULL,
  facts jsonb NOT NULL DEFAULT '{}'::jsonb,   -- the exact inputs the draft was written from
  model text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_by uuid,
  approved_at timestamptz,
  UNIQUE (project_id, kind, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_packages TO authenticated;
GRANT ALL ON public.investment_packages TO service_role;
ALTER TABLE public.investment_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "country access packages" ON public.investment_packages;
CREATE POLICY "country access packages" ON public.investment_packages FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE OR REPLACE FUNCTION public.investment_packages_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  proj public.investment_projects;
BEGIN
  SELECT * INTO proj FROM public.investment_projects WHERE id = NEW.project_id;
  NEW.country_code := proj.country_code;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(actor, NEW.created_by);
    IF actor IS NOT NULL THEN NEW.status := 'draft'; END IF;
    NEW.approved_by := NULL; NEW.approved_at := NULL;
    RETURN NEW;
  END IF;
  IF actor IS NULL THEN RETURN NEW; END IF;
  NEW.created_by := OLD.created_by; NEW.project_version := OLD.project_version; NEW.version := OLD.version;
  IF OLD.status <> 'draft' AND (NEW.content, NEW.facts) IS DISTINCT FROM (OLD.content, OLD.facts) THEN
    RAISE EXCEPTION 'An approved package cannot be edited. Generate a new version.';
  END IF;
  IF NEW.status = 'approved' AND OLD.status = 'draft' THEN
    IF actor = OLD.created_by THEN
      RAISE EXCEPTION 'Two-person rule: the person who drafted this package cannot approve it.';
    END IF;
    IF NOT public.can_approve_investment(actor, NEW.country_code) THEN
      RAISE EXCEPTION 'You do not hold an approver role for investments in this country.';
    END IF;
    IF proj.approval_status <> 'approved' THEN
      RAISE EXCEPTION 'Approve the project before approving its investor materials.';
    END IF;
    IF OLD.project_version <> proj.version THEN
      RAISE EXCEPTION 'The project has changed since this package was drafted. Generate a new version.';
    END IF;
    IF jsonb_typeof(NEW.content->'warnings') = 'array' AND jsonb_array_length(NEW.content->'warnings') > 0 THEN
      RAISE EXCEPTION 'This draft contains figures that could not be matched to the project''s facts. Regenerate it before approval.';
    END IF;
    NEW.approved_by := actor; NEW.approved_at := now();
    UPDATE public.investment_packages SET status = 'superseded'
      WHERE project_id = NEW.project_id AND kind = NEW.kind AND status = 'approved' AND id <> NEW.id;
    PERFORM public.log_governance('package.approved', 'investment_project', NEW.project_id::text, NEW.country_code,
      jsonb_build_object('kind', NEW.kind, 'version', NEW.version, 'project_version', NEW.project_version));
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = 'approved' AND NEW.status = 'superseded') THEN
    RAISE EXCEPTION 'A package cannot move from % to %.', OLD.status, NEW.status;
  ELSE
    NEW.approved_by := OLD.approved_by; NEW.approved_at := OLD.approved_at;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS investment_packages_guard ON public.investment_packages;
CREATE TRIGGER investment_packages_guard BEFORE INSERT OR UPDATE ON public.investment_packages
  FOR EACH ROW EXECUTE FUNCTION public.investment_packages_guard();

-- Counts a view atomically (so max_views cannot be overrun by simultaneous
-- visits) and records it. Service role only: called by the public page.
CREATE OR REPLACE FUNCTION public.record_investment_share_view(
  _link_id uuid, _visitor_hash text, _user_agent text, _referrer text, _event text, _count boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cc text;
BEGIN
  IF _count THEN
    UPDATE public.investment_share_links
       SET view_count = view_count + 1, last_viewed_at = now()
     WHERE id = _link_id AND revoked_at IS NULL AND expires_at > now()
       AND (max_views IS NULL OR view_count < max_views)
    RETURNING country_code INTO cc;
    IF cc IS NULL THEN RETURN false; END IF;
  ELSE
    SELECT country_code INTO cc FROM public.investment_share_links WHERE id = _link_id;
    IF cc IS NULL THEN RETURN false; END IF;
  END IF;
  INSERT INTO public.investment_share_views (link_id, country_code, visitor_hash, user_agent, referrer, event)
  VALUES (_link_id, cc, _visitor_hash, left(_user_agent, 200), left(_referrer, 200), _event);
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_investment_share_view(uuid, text, text, text, text, boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_investment_share_view(uuid, text, text, text, text, boolean) TO service_role;

-- Public project links are off until an admin turns them on.
INSERT INTO public.app_settings (key, value) VALUES ('public_project_links_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
