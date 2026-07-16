
-- 1) Helper: country-scoped access (global admin passes)
CREATE OR REPLACE FUNCTION public.has_country_access(_user_id uuid, _country_code text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'::public.app_role
      AND country_code IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND country_code = _country_code
  );
$$;

-- 2) Add visibility columns to every corpus table
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'country_sources','country_source_documents','country_source_chunks',
    'memory_objects','country_kpis','country_kpi_points',
    'sector_dossiers','ministry_profiles',
    'onboarding_citations','country_capital_flows','capital_flow_research_attempts',
    'citations'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT ''public''', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS owner_country_code text NULL', t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS uploaded_by uuid NULL', t);
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_visibility_chk');
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (visibility IN (''public'',''private''))', t, t || '_visibility_chk');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (visibility, owner_country_code)', t || '_visibility_idx', t);
  END LOOP;
END $$;

-- 3) Backfill: existing rows are public (idempotent)
UPDATE public.country_sources SET visibility='public' WHERE visibility IS NULL;
UPDATE public.country_source_documents SET visibility='public' WHERE visibility IS NULL;
UPDATE public.country_source_chunks SET visibility='public' WHERE visibility IS NULL;
UPDATE public.memory_objects SET visibility='public' WHERE visibility IS NULL;
UPDATE public.country_kpis SET visibility='public' WHERE visibility IS NULL;
UPDATE public.country_kpi_points SET visibility='public' WHERE visibility IS NULL;
UPDATE public.sector_dossiers SET visibility='public' WHERE visibility IS NULL;
UPDATE public.ministry_profiles SET visibility='public' WHERE visibility IS NULL;
UPDATE public.onboarding_citations SET visibility='public' WHERE visibility IS NULL;
UPDATE public.country_capital_flows SET visibility='public' WHERE visibility IS NULL;
UPDATE public.capital_flow_research_attempts SET visibility='public' WHERE visibility IS NULL;
UPDATE public.citations SET visibility='public' WHERE visibility IS NULL;

-- 4) Trigger: private rows must carry owner_country_code + uploaded_by
CREATE OR REPLACE FUNCTION public.enforce_private_ownership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cc text;
BEGIN
  IF NEW.visibility = 'private' THEN
    -- try to infer country_code column from the row if present
    BEGIN
      cc := row_to_json(NEW)::jsonb->>'country_code';
    EXCEPTION WHEN OTHERS THEN
      cc := NULL;
    END;
    IF NEW.owner_country_code IS NULL THEN
      NEW.owner_country_code := cc;
    END IF;
    IF NEW.owner_country_code IS NULL THEN
      RAISE EXCEPTION 'private rows require owner_country_code';
    END IF;
    IF NEW.uploaded_by IS NULL THEN
      NEW.uploaded_by := auth.uid();
    END IF;
    IF NEW.uploaded_by IS NULL THEN
      RAISE EXCEPTION 'private rows require uploaded_by';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'country_sources','country_source_documents','country_source_chunks',
    'memory_objects','country_kpis','country_kpi_points',
    'sector_dossiers','ministry_profiles',
    'onboarding_citations','country_capital_flows','capital_flow_research_attempts',
    'citations'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_enforce_private', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_private_ownership()', t || '_enforce_private', t);
  END LOOP;
END $$;

-- 5) Rewrite SELECT RLS so public is universally readable, private is country-scoped.
--    Drop only the policies we manage; leave existing admin/write policies intact.
DO $$
DECLARE
  t text;
  cc_col text;
  tables text[] := ARRAY[
    'country_sources','country_source_documents','country_source_chunks',
    'memory_objects','country_kpis','country_kpi_points',
    'sector_dossiers','ministry_profiles',
    'onboarding_citations','country_capital_flows','capital_flow_research_attempts',
    'citations'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_visibility_read', t);
    -- pick the country column if the table has one
    SELECT column_name INTO cc_col
      FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='country_code'
      LIMIT 1;
    IF cc_col IS NOT NULL THEN
      EXECUTE format($p$
        CREATE POLICY %I ON public.%I
        FOR SELECT TO authenticated, anon
        USING (
          visibility = 'public'
          OR (auth.uid() IS NOT NULL AND public.has_country_access(auth.uid(), COALESCE(owner_country_code, country_code)))
        )
      $p$, t || '_visibility_read', t);
    ELSE
      EXECUTE format($p$
        CREATE POLICY %I ON public.%I
        FOR SELECT TO authenticated, anon
        USING (
          visibility = 'public'
          OR (auth.uid() IS NOT NULL AND owner_country_code IS NOT NULL AND public.has_country_access(auth.uid(), owner_country_code))
        )
      $p$, t || '_visibility_read', t);
    END IF;
  END LOOP;
END $$;
