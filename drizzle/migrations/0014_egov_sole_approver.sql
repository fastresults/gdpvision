-- 0014 · Digital Government Studio: sole-approver exception
--
-- The two-person rule (0012) stands: the person who submitted a PRD cannot
-- approve it. One narrow exception, taken on the platform owner's authority:
-- when NOBODY ELSE holds an approver role for the country, a global admin
-- may approve their own submission. The approval is stamped
-- approval_mode = 'sole_admin' and logged as egov_prd.approved with
-- mode 'sole_admin', so the audit trail shows exactly which approvals were
-- not counter-signed. The moment a second approver is bound to the country
-- the exception closes on its own.

ALTER TABLE public.egov_prds
  ADD COLUMN IF NOT EXISTS approval_mode text
  CHECK (approval_mode IS NULL OR approval_mode IN ('two_person','sole_admin'));

-- Is there any approver for this country other than _user_id?
CREATE OR REPLACE FUNCTION public.egov_other_approver_exists(_user_id uuid, _country_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id <> _user_id
      AND (
        (r.role IN ('country_admin','cabinet_secretary')
          AND (r.country_code IS NULL OR r.country_code = _country_code))
        OR (r.role = 'admin' AND r.country_code IS NULL)
      )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.egov_other_approver_exists(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.egov_other_approver_exists(uuid, text) TO authenticated, service_role;

-- May _user_id approve their own submission for this country? Global admin,
-- and no other approver exists.
CREATE OR REPLACE FUNCTION public.can_sole_approve_egov(_user_id uuid, _country_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role)
     AND NOT public.egov_other_approver_exists(_user_id, _country_code);
$$;
REVOKE EXECUTE ON FUNCTION public.can_sole_approve_egov(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_sole_approve_egov(uuid, text) TO authenticated, service_role;

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
    NEW.approved_by := NULL; NEW.approved_at := NULL; NEW.approval_mode := NULL;
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
  NEW.approval_mode := OLD.approval_mode;
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
    IF EXISTS (SELECT 1 FROM public.egov_prd_sections s WHERE s.prd_id = NEW.id AND s.status = 'pending') THEN
      RAISE EXCEPTION 'Every section must be drafted before the PRD is submitted for approval.';
    END IF;
    NEW.submitted_by := actor; NEW.submitted_at := now();
    NEW.returned_by := NULL; NEW.returned_at := NULL;

  ELSIF OLD.status = 'submitted' AND NEW.status = 'approved' THEN
    IF changed THEN RAISE EXCEPTION 'Approving cannot change the PRD. Return it with a note instead.'; END IF;
    IF NOT public.can_approve_egov(actor, OLD.country_code) THEN
      RAISE EXCEPTION 'You do not hold an approver role for this country.';
    END IF;
    IF actor = OLD.submitted_by THEN
      IF NOT public.can_sole_approve_egov(actor, OLD.country_code) THEN
        RAISE EXCEPTION 'Two-person rule: the person who submitted this PRD cannot approve it.';
      END IF;
      NEW.approval_mode := 'sole_admin';
    ELSE
      NEW.approval_mode := 'two_person';
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
    NEW.approved_by := NULL; NEW.approved_at := NULL; NEW.approval_mode := NULL;

  ELSIF OLD.status = 'approved' AND NEW.status = 'superseded' THEN
    NULL;

  ELSE
    RAISE EXCEPTION 'A PRD cannot move from % to %.', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

-- History: record the approval mode so sole-admin approvals are visible in the log.
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
      'mode', CASE WHEN act = 'egov_prd.approved' THEN NEW.approval_mode END,
      'note', CASE WHEN act = 'egov_prd.returned' THEN NEW.returned_note END));
  RETURN NULL;
END;
$$;
