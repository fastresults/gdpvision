-- 0022 · Machinery of government: offices of state, Cabinet, statutory bodies
--
-- The corpus held the Prime Minister only as free text in the onboarding
-- profile, Cabinet only as a minister's name on each ministry profile, and
-- statutory bodies not at all. This adds one structured record per country
-- that the PRD context packs (chamber 09), the Sector Studio (chamber 10)
-- and the public API's new `government` resource all read.
--
--   1. government_offices — head of state, head of government, deputy,
--      Cabinet ministers and other offices, in order of precedence.
--   2. statutory_bodies — authorities, commissions, boards, regulators and
--      state-owned enterprises, each under its parent ministry.
--   3. Review: rows arrive as drafts (research or back-fill); only a verified
--      row can be made public, and only public rows leave through the API.
--   4. The `government` API scope: new keys get it by default; active keys
--      are granted it once here, and the grant is written to the audit log.

-- ---------------------------------------------------------------- 1 offices

CREATE TABLE IF NOT EXISTS public.government_offices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  -- head_of_state | governor_general | head_of_government | deputy_head_of_government
  -- | cabinet_minister | minister_of_state | attorney_general | parliamentary_secretary
  -- | cabinet_secretary | speaker | president_of_senate | leader_of_opposition | other
  office_key text NOT NULL,
  title text NOT NULL,
  holder_name text,
  -- The ministry this office heads, when it heads one (ministries.slug).
  ministry_slug text,
  portfolio text NOT NULL DEFAULT '',
  precedence integer NOT NULL DEFAULT 100,
  party text,
  appointed_on date,
  portrait_url text,
  bio text,
  -- Public office contact only: { office_phone, email, office_address, website }.
  contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_url text,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence text NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low','medium','high')),
  origin text NOT NULL DEFAULT 'research' CHECK (origin IN ('research','backfill','manual')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','verified','retired')),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','private')),
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, office_key, portfolio)
);
CREATE INDEX IF NOT EXISTS government_offices_country_idx ON public.government_offices (country_code, precedence);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.government_offices TO authenticated;
GRANT ALL ON public.government_offices TO service_role;
ALTER TABLE public.government_offices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read government offices" ON public.government_offices;
CREATE POLICY "read government offices" ON public.government_offices FOR SELECT TO authenticated
  USING (public.has_country_access(auth.uid(), country_code));
DROP POLICY IF EXISTS "write government offices" ON public.government_offices;
CREATE POLICY "write government offices" ON public.government_offices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.can_approve_egov(auth.uid(), country_code))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.can_approve_egov(auth.uid(), country_code));

-- ---------------------------------------------------------------- 2 statutory bodies

CREATE TABLE IF NOT EXISTS public.statutory_bodies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  acronym text,
  -- statutory_body | authority | commission | board | regulator | corporation
  -- | state_owned_enterprise | agency | fund | other
  kind text NOT NULL DEFAULT 'statutory_body',
  parent_ministry_slug text,
  enabling_act text,
  act_year integer,
  mandate text NOT NULL DEFAULT '',
  head_name text,
  head_title text,
  board_chair text,
  sector_code text,
  -- Public services the body delivers, as short labels.
  services jsonb NOT NULL DEFAULT '[]'::jsonb,
  website text,
  contact jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_url text,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence text NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low','medium','high')),
  origin text NOT NULL DEFAULT 'research' CHECK (origin IN ('research','backfill','manual')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','verified','retired')),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','private')),
  verified_by uuid,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, slug)
);
CREATE INDEX IF NOT EXISTS statutory_bodies_country_idx ON public.statutory_bodies (country_code, parent_ministry_slug);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.statutory_bodies TO authenticated;
GRANT ALL ON public.statutory_bodies TO service_role;
ALTER TABLE public.statutory_bodies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read statutory bodies" ON public.statutory_bodies;
CREATE POLICY "read statutory bodies" ON public.statutory_bodies FOR SELECT TO authenticated
  USING (public.has_country_access(auth.uid(), country_code));
DROP POLICY IF EXISTS "write statutory bodies" ON public.statutory_bodies;
CREATE POLICY "write statutory bodies" ON public.statutory_bodies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.can_approve_egov(auth.uid(), country_code))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.can_approve_egov(auth.uid(), country_code));

-- ---------------------------------------------------------------- 3 review

-- Shared by both tables: only a verified row may be public; verifying stamps
-- who and when; any content change to a verified row sends it back to draft
-- (and private) so a person looks again. History to audit_log.
CREATE OR REPLACE FUNCTION public.machinery_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  actor uuid := auth.uid();
  content_changed boolean := false;
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'UPDATE' THEN
    IF NEW.country_code IS DISTINCT FROM OLD.country_code THEN
      RAISE EXCEPTION 'A record cannot be moved to another country.';
    END IF;
    content_changed := (to_jsonb(NEW) - ARRAY['status','visibility','verified_by','verified_at','updated_at','created_at'])
                    IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','visibility','verified_by','verified_at','updated_at','created_at']);
    IF content_changed AND OLD.status = 'verified' AND NEW.status = 'verified' THEN
      NEW.status := 'draft';
      NEW.visibility := 'private';
    END IF;
  END IF;

  IF NEW.status = 'verified' AND (TG_OP = 'INSERT' OR OLD.status <> 'verified') THEN
    NEW.verified_by := COALESCE(actor, NEW.verified_by);
    NEW.verified_at := now();
  ELSIF NEW.status <> 'verified' THEN
    NEW.verified_by := NULL;
    NEW.verified_at := NULL;
  END IF;

  IF NEW.visibility = 'public' AND NEW.status <> 'verified' THEN
    RAISE EXCEPTION 'Verify this record before making it public.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.machinery_history()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  act text;
  r record;
  entity text := CASE WHEN TG_TABLE_NAME = 'government_offices' THEN 'government_office' ELSE 'statutory_body' END;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  IF TG_OP = 'INSERT' THEN act := entity || '.created';
  ELSIF TG_OP = 'DELETE' THEN act := entity || '.deleted';
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN act := entity || '.' || NEW.status;
  ELSIF NEW.visibility IS DISTINCT FROM OLD.visibility THEN act := entity || '.' || NEW.visibility;
  ELSE act := entity || '.edited';
  END IF;
  PERFORM public.log_governance(act, entity, r.id::text, r.country_code,
    jsonb_build_object('status', r.status, 'visibility', r.visibility,
      'name', CASE WHEN TG_TABLE_NAME = 'government_offices' THEN (to_jsonb(r)->>'title') ELSE (to_jsonb(r)->>'name') END));
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS government_offices_guard ON public.government_offices;
CREATE TRIGGER government_offices_guard BEFORE INSERT OR UPDATE ON public.government_offices
  FOR EACH ROW EXECUTE FUNCTION public.machinery_guard();
DROP TRIGGER IF EXISTS government_offices_history ON public.government_offices;
CREATE TRIGGER government_offices_history AFTER INSERT OR UPDATE OR DELETE ON public.government_offices
  FOR EACH ROW EXECUTE FUNCTION public.machinery_history();
DROP TRIGGER IF EXISTS statutory_bodies_guard ON public.statutory_bodies;
CREATE TRIGGER statutory_bodies_guard BEFORE INSERT OR UPDATE ON public.statutory_bodies
  FOR EACH ROW EXECUTE FUNCTION public.machinery_guard();
DROP TRIGGER IF EXISTS statutory_bodies_history ON public.statutory_bodies;
CREATE TRIGGER statutory_bodies_history AFTER INSERT OR UPDATE OR DELETE ON public.statutory_bodies
  FOR EACH ROW EXECUTE FUNCTION public.machinery_history();

-- ---------------------------------------------------------------- 4 API scope

ALTER TABLE public.egov_api_keys
  ALTER COLUMN scopes SET DEFAULT '{brand,kpis,commitments,ministries,government,sectors,datasets,procurement,projects,brain,sources}';

-- One-time grant to active keys (the content is public by construction:
-- verified and public rows only). Runs as the service role, so the key guard
-- lets it through; each grant is recorded.
WITH granted AS (
  UPDATE public.egov_api_keys
     SET scopes = array_append(scopes, 'government')
   WHERE revoked_at IS NULL
     AND expires_at > now()
     AND NOT ('government' = ANY (scopes))
  RETURNING id, country_code, label
)
SELECT public.log_governance('egov_api_key.scope_granted', 'egov_api_key', g.id::text, g.country_code,
         jsonb_build_object('scope', 'government', 'label', g.label, 'by', 'migration 0022'))
  FROM granted g;
