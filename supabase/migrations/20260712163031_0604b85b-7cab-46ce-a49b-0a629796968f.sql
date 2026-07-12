-- =========================================================================
-- 1. Country-aware role check
-- =========================================================================
CREATE OR REPLACE FUNCTION public.has_country_role(
  _user_id uuid,
  _role public.app_role,
  _country_code text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (country_code IS NULL OR country_code = _country_code)
  )
  OR EXISTS (
    -- Global admin always passes any country-scoped check
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'::public.app_role
      AND country_code IS NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_country_role(uuid, public.app_role, text)
  TO authenticated, service_role;

-- =========================================================================
-- 2. Country access requests
-- =========================================================================
CREATE TABLE public.country_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code text NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  requested_role public.app_role NOT NULL DEFAULT 'advisor',
  note text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied')),
  decided_by uuid REFERENCES auth.users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX country_access_requests_one_pending_per_user_country
  ON public.country_access_requests(user_id, country_code)
  WHERE status = 'pending';

CREATE INDEX country_access_requests_country_status
  ON public.country_access_requests(country_code, status);

GRANT SELECT, INSERT, UPDATE ON public.country_access_requests TO authenticated;
GRANT ALL ON public.country_access_requests TO service_role;

ALTER TABLE public.country_access_requests ENABLE ROW LEVEL SECURITY;

-- Users see and create their own requests
CREATE POLICY "Users read own access requests"
  ON public.country_access_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users create own access requests"
  ON public.country_access_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Country admins (and super admins) see and update requests for their country
CREATE POLICY "Country admins read requests for their country"
  ON public.country_access_requests FOR SELECT
  TO authenticated
  USING (public.has_country_role(auth.uid(), 'country_admin'::public.app_role, country_code));

CREATE POLICY "Country admins decide requests for their country"
  ON public.country_access_requests FOR UPDATE
  TO authenticated
  USING (public.has_country_role(auth.uid(), 'country_admin'::public.app_role, country_code))
  WITH CHECK (public.has_country_role(auth.uid(), 'country_admin'::public.app_role, country_code));

-- updated_at trigger
CREATE TRIGGER country_access_requests_updated_at
  BEFORE UPDATE ON public.country_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================================
-- 3. Extend write policies so country_admin can manage their country
-- =========================================================================

-- instance_bindings: previously only global admin. Now country admin too.
DROP POLICY IF EXISTS "Admins manage bindings" ON public.instance_bindings;
CREATE POLICY "Admins and country admins manage bindings"
  ON public.instance_bindings FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_country_role(auth.uid(), 'country_admin'::public.app_role, country_code)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_country_role(auth.uid(), 'country_admin'::public.app_role, country_code)
  );

-- ministries: allow country_admin scoped to country_code
DROP POLICY IF EXISTS "ministries writable by steward/admin" ON public.ministries;
CREATE POLICY "ministries writable by steward/admin/country_admin"
  ON public.ministries FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'data_steward'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_country_role(auth.uid(), 'country_admin'::public.app_role, country_code)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'data_steward'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_country_role(auth.uid(), 'country_admin'::public.app_role, country_code)
  );

-- ministry_sectors: derive country via the parent ministry
DROP POLICY IF EXISTS "ministry_sectors writable by steward/admin" ON public.ministry_sectors;
CREATE POLICY "ministry_sectors writable by steward/admin/country_admin"
  ON public.ministry_sectors FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'data_steward'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = ministry_sectors.ministry_id
        AND public.has_country_role(auth.uid(), 'country_admin'::public.app_role, m.country_code)
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'data_steward'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.ministries m
      WHERE m.id = ministry_sectors.ministry_id
        AND public.has_country_role(auth.uid(), 'country_admin'::public.app_role, m.country_code)
    )
  );

-- country_sectors: currently only SELECT policy exists. Add write policy.
CREATE POLICY "country_sectors writable by steward/admin/country_admin"
  ON public.country_sectors FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'data_steward'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_country_role(auth.uid(), 'country_admin'::public.app_role, country_code)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'data_steward'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_country_role(auth.uid(), 'country_admin'::public.app_role, country_code)
  );

-- =========================================================================
-- 4. GDP baseline columns on countries
-- =========================================================================
ALTER TABLE public.countries
  ADD COLUMN IF NOT EXISTS gdp_current_usd numeric,
  ADD COLUMN IF NOT EXISTS gdp_year smallint;

-- Allow country_admin / steward / admin to update their country row
CREATE POLICY "countries updatable by steward/admin/country_admin"
  ON public.countries FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'data_steward'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_country_role(auth.uid(), 'country_admin'::public.app_role, code)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'data_steward'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_country_role(auth.uid(), 'country_admin'::public.app_role, code)
  );