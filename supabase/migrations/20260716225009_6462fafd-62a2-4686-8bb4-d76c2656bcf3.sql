
CREATE TABLE public.minister_backfill_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','cancelled')),
  requested_by uuid,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  heartbeat_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.minister_backfill_runs TO authenticated;
GRANT ALL ON public.minister_backfill_runs TO service_role;

ALTER TABLE public.minister_backfill_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read backfill runs" ON public.minister_backfill_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.minister_backfill_country_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.minister_backfill_runs(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','skipped','cancelled')),
  attempted int NOT NULL DEFAULT 0,
  resolved int NOT NULL DEFAULT 0,
  updated int NOT NULL DEFAULT 0,
  skipped int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  ministries jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, country_code)
);

GRANT SELECT ON public.minister_backfill_country_runs TO authenticated;
GRANT ALL ON public.minister_backfill_country_runs TO service_role;

ALTER TABLE public.minister_backfill_country_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read backfill country runs" ON public.minister_backfill_country_runs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX minister_backfill_runs_created_at_idx ON public.minister_backfill_runs (created_at DESC);
CREATE INDEX minister_backfill_country_runs_run_id_idx ON public.minister_backfill_country_runs (run_id);
