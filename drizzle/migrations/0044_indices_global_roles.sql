-- Caribbean Indices: only GLOBAL admins and data stewards reach private index data.
--
-- The indices are regional: one run scores every state, and trackers and draft
-- scores are private until an official edition is published. The steward policies
-- from 0040 used public.is_admin_or_steward(), which calls has_role() and so ignores
-- user_roles.country_code. A steward (or admin) scoped to ONE country could read
-- every state's runs, frozen inputs, draft scores and private trackers, and enter or
-- change evidence for any state, by querying Supabase directly.
--
-- This migration gives the index_* tables their own check, counting only roles with
-- country_code IS NULL. It matches the server-side check in src/lib/indices/access.ts.
-- public.is_admin_or_steward() and has_role() are NOT changed: other tables rely on them.
-- The published-edition policies (any signed-in user may read a published official
-- edition) are unchanged. Safe to re-run.

CREATE OR REPLACE FUNCTION public.is_indices_steward()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- the caller only (auth.uid()), so it cannot be used to probe other users' roles
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles
     WHERE user_id = auth.uid()
       AND country_code IS NULL
       AND role IN ('admin'::public.app_role, 'data_steward'::public.app_role)
  )
$$;
REVOKE ALL ON FUNCTION public.is_indices_steward() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_indices_steward() TO authenticated, service_role;

-- evidence: read, enter, correct, verify
DROP POLICY IF EXISTS "index evidence stewards read" ON public.index_evidence;
CREATE POLICY "index evidence stewards read" ON public.index_evidence
  FOR SELECT TO authenticated USING (public.is_indices_steward());
DROP POLICY IF EXISTS "index evidence stewards write" ON public.index_evidence;
CREATE POLICY "index evidence stewards write" ON public.index_evidence
  FOR INSERT TO authenticated WITH CHECK (public.is_indices_steward());
DROP POLICY IF EXISTS "index evidence stewards update" ON public.index_evidence;
CREATE POLICY "index evidence stewards update" ON public.index_evidence
  FOR UPDATE TO authenticated
  USING (public.is_indices_steward()) WITH CHECK (public.is_indices_steward());

-- runs, frozen inputs, scores, releases: private until published
DROP POLICY IF EXISTS "index runs stewards read" ON public.index_runs;
CREATE POLICY "index runs stewards read" ON public.index_runs
  FOR SELECT TO authenticated USING (public.is_indices_steward());
DROP POLICY IF EXISTS "index inputs stewards read" ON public.index_inputs;
CREATE POLICY "index inputs stewards read" ON public.index_inputs
  FOR SELECT TO authenticated USING (public.is_indices_steward());
DROP POLICY IF EXISTS "index scores stewards read" ON public.index_scores;
CREATE POLICY "index scores stewards read" ON public.index_scores
  FOR SELECT TO authenticated USING (public.is_indices_steward());
DROP POLICY IF EXISTS "index releases stewards read" ON public.index_releases;
CREATE POLICY "index releases stewards read" ON public.index_releases
  FOR SELECT TO authenticated USING (public.is_indices_steward());
