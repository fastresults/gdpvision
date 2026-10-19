UPDATE public.index_runs
   SET status = 'failed',
       error = coalesce(error, 'Run did not finish (timed out or cancelled).'),
       finished_at = coalesce(finished_at, now())
 WHERE status = 'running'
   AND started_at < now() - interval '10 minutes';

CREATE UNIQUE INDEX IF NOT EXISTS index_runs_one_running
  ON public.index_runs ((true))
  WHERE status = 'running';

NOTIFY pgrst, 'reload schema';