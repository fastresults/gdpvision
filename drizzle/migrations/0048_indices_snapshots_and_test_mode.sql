-- Caribbean Indices: source snapshots, input provenance, and a private TEST mode.
-- Owner decisions of 19 Oct 2026 (Adam Anderson). Safe to re-run.
--
-- 1. index_source_snapshots: the last good copy of every API series (WDI, IMF WEO) per
--    country. Written by the runner (service role) after each successful fetch; used when a
--    live source still fails after its retries, if captured within 30 days.
-- 2. index_inputs.origin ('live' | 'snapshot' | 'test_fixture') and snapshot_at, so every
--    value says where it came from.
-- 3. Run mode 'test' and release kind 'test'. The existing CHECK on index_releases already
--    allows status 'published' only for kind 'edition', so a test release can never be
--    published. Test releases are private (steward policies) and expire after 14 days.
-- The partner-only scope 'indices_test' (read the latest test release with ?edition=test) is
-- NOT granted here: granting it to a key is a separate, owner-approved step.

-- 1 · snapshots
CREATE TABLE IF NOT EXISTS public.index_source_snapshots (
  source_kind text NOT NULL CHECK (source_kind IN ('wdi','imf_weo')),
  source_code text NOT NULL,
  country_code text NOT NULL,
  observations jsonb NOT NULL DEFAULT '[]'::jsonb,
  grade char(1) CHECK (grade IN ('A','B','C','D')),
  source_url text,
  source_org text,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  run_id uuid,
  PRIMARY KEY (source_kind, source_code, country_code)
);
CREATE INDEX IF NOT EXISTS index_source_snapshots_retrieved ON public.index_source_snapshots (source_kind, source_code, retrieved_at);
GRANT SELECT ON public.index_source_snapshots TO authenticated;
GRANT ALL ON public.index_source_snapshots TO service_role;
ALTER TABLE public.index_source_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "index snapshots stewards read" ON public.index_source_snapshots;
CREATE POLICY "index snapshots stewards read" ON public.index_source_snapshots
  FOR SELECT TO authenticated USING (public.is_indices_steward());

-- 2 · input provenance
ALTER TABLE public.index_inputs ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'live';
ALTER TABLE public.index_inputs ADD COLUMN IF NOT EXISTS snapshot_at timestamptz;
ALTER TABLE public.index_inputs DROP CONSTRAINT IF EXISTS index_inputs_origin_check;
ALTER TABLE public.index_inputs ADD CONSTRAINT index_inputs_origin_check
  CHECK (origin IN ('live','snapshot','test_fixture'));

-- 3 · test mode
-- Drop whichever CHECK constrains index_runs.mode / index_releases.kind today (its name may
-- differ from the one Postgres would generate), then add the widened ones by name.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname, rel.relname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
     WHERE ns.nspname = 'public' AND con.contype = 'c'
       AND ((rel.relname = 'index_runs' AND pg_get_constraintdef(con.oid) ~ '\mmode\M' AND pg_get_constraintdef(con.oid) ~ 'watch')
         OR (rel.relname = 'index_releases' AND pg_get_constraintdef(con.oid) ~ '\mkind\M' AND pg_get_constraintdef(con.oid) ~ 'tracker'
             AND pg_get_constraintdef(con.oid) !~ 'published'))
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.relname, r.conname);
  END LOOP;
END $$;
ALTER TABLE public.index_runs ADD CONSTRAINT index_runs_mode_check
  CHECK (mode IN ('watch','tracker','edition','test'));
ALTER TABLE public.index_releases ADD CONSTRAINT index_releases_kind_check
  CHECK (kind IN ('tracker','edition','test'));
-- belt and braces: test data can never sit in a published release, whatever else changes
ALTER TABLE public.index_releases DROP CONSTRAINT IF EXISTS index_releases_test_never_published;
ALTER TABLE public.index_releases ADD CONSTRAINT index_releases_test_never_published
  CHECK (kind <> 'test' OR status IN ('draft','withdrawn'));

-- Test values belong to test runs, and test runs only ever produce test releases.
CREATE OR REPLACE FUNCTION public.index_test_data_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE run_mode text;
BEGIN
  IF TG_TABLE_NAME = 'index_inputs' THEN
    IF NEW.origin = 'test_fixture' THEN
      SELECT mode INTO run_mode FROM public.index_runs WHERE id = NEW.run_id;
      IF run_mode IS DISTINCT FROM 'test' THEN
        RAISE EXCEPTION 'Test values may only be stored on a test run.';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'index_releases' THEN
    SELECT mode INTO run_mode FROM public.index_runs WHERE id = NEW.run_id;
    IF (run_mode = 'test') <> (NEW.kind = 'test') THEN
      RAISE EXCEPTION 'A test run makes only a test release, and a test release needs a test run.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS index_inputs_test_guard ON public.index_inputs;
CREATE TRIGGER index_inputs_test_guard BEFORE INSERT OR UPDATE OF origin, run_id ON public.index_inputs
  FOR EACH ROW EXECUTE FUNCTION public.index_test_data_guard();
DROP TRIGGER IF EXISTS index_releases_test_guard ON public.index_releases;
CREATE TRIGGER index_releases_test_guard BEFORE INSERT OR UPDATE OF kind, run_id ON public.index_releases
  FOR EACH ROW EXECUTE FUNCTION public.index_test_data_guard();
