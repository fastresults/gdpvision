-- 0013 · Digital Government Studio — platform API keys
--
-- A country's e-government platform (built from its approved PRD) reads
-- GDPVision through /api/public/v1 with a per-country key. The key itself is
-- shown once and never stored; only its hash is. Keys are scoped to a set of
-- resources, expire, and can only be revoked, never edited.

CREATE TABLE IF NOT EXISTS public.egov_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  prd_id uuid REFERENCES public.egov_prds(id) ON DELETE SET NULL,
  label text NOT NULL,                    -- e.g. "gov.ag production"
  key_hash text NOT NULL UNIQUE,          -- sha256(key), hex
  key_hint text NOT NULL,                 -- last 4 characters
  scopes text[] NOT NULL DEFAULT '{brand,kpis,commitments,ministries,sectors,datasets,procurement,projects,brain,sources}',
  allowed_origins text[] NOT NULL DEFAULT '{}',   -- CORS origins the platform calls from; empty = any
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz,
  request_count bigint NOT NULL DEFAULT 0,
  revoked_at timestamptz,
  revoked_by uuid,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at <= created_at + interval '2 years')
);
CREATE INDEX IF NOT EXISTS egov_api_keys_country_idx ON public.egov_api_keys (country_code, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.egov_api_keys TO authenticated;
GRANT ALL ON public.egov_api_keys TO service_role;
ALTER TABLE public.egov_api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read api keys" ON public.egov_api_keys;
CREATE POLICY "read api keys" ON public.egov_api_keys FOR SELECT TO authenticated
  USING (public.has_country_access(auth.uid(), country_code));
DROP POLICY IF EXISTS "approvers create api keys" ON public.egov_api_keys;
CREATE POLICY "approvers create api keys" ON public.egov_api_keys FOR INSERT TO authenticated
  WITH CHECK (public.can_approve_egov(auth.uid(), country_code));
DROP POLICY IF EXISTS "approvers revoke api keys" ON public.egov_api_keys;
CREATE POLICY "approvers revoke api keys" ON public.egov_api_keys FOR UPDATE TO authenticated
  USING (public.can_approve_egov(auth.uid(), country_code))
  WITH CHECK (public.can_approve_egov(auth.uid(), country_code));

CREATE OR REPLACE FUNCTION public.egov_api_keys_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(actor, NEW.created_by);
    NEW.last_used_at := NULL; NEW.request_count := 0; NEW.revoked_at := NULL; NEW.revoked_by := NULL;
    PERFORM public.log_governance('egov_api_key.created', 'egov_api_key', NEW.id::text, NEW.country_code,
      jsonb_build_object('label', NEW.label, 'scopes', NEW.scopes, 'expires_at', NEW.expires_at, 'hint', NEW.key_hint));
    RETURN NEW;
  END IF;
  IF actor IS NULL THEN RETURN NEW; END IF;   -- service role: usage counters
  IF (NEW.country_code, NEW.prd_id, NEW.label, NEW.key_hash, NEW.key_hint, NEW.scopes, NEW.allowed_origins,
      NEW.expires_at, NEW.last_used_at, NEW.request_count, NEW.created_by, NEW.created_at)
     IS DISTINCT FROM
     (OLD.country_code, OLD.prd_id, OLD.label, OLD.key_hash, OLD.key_hint, OLD.scopes, OLD.allowed_origins,
      OLD.expires_at, OLD.last_used_at, OLD.request_count, OLD.created_by, OLD.created_at) THEN
    RAISE EXCEPTION 'An API key cannot be edited, only revoked. Create a new one instead.';
  END IF;
  IF OLD.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'This key is already revoked.'; END IF;
  IF NEW.revoked_at IS NOT NULL THEN
    NEW.revoked_at := now(); NEW.revoked_by := actor;
    PERFORM public.log_governance('egov_api_key.revoked', 'egov_api_key', NEW.id::text, NEW.country_code,
      jsonb_build_object('label', NEW.label, 'hint', NEW.key_hint));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS egov_api_keys_guard ON public.egov_api_keys;
CREATE TRIGGER egov_api_keys_guard BEFORE INSERT OR UPDATE ON public.egov_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.egov_api_keys_guard();

-- Resolves a presented key. Service role only: called by the public API.
CREATE OR REPLACE FUNCTION public.resolve_egov_api_key(_key_hash text)
RETURNS TABLE (id uuid, country_code text, prd_id uuid, label text, scopes text[], allowed_origins text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
    UPDATE public.egov_api_keys k
       SET last_used_at = now(), request_count = k.request_count + 1
     WHERE k.key_hash = _key_hash AND k.revoked_at IS NULL AND k.expires_at > now()
    RETURNING k.id, k.country_code, k.prd_id, k.label, k.scopes, k.allowed_origins;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.resolve_egov_api_key(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_egov_api_key(text) TO service_role;
