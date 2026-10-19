-- Caribbean Indices: at most one run in progress.
-- The runner checks for a running run and then inserts its own; two requests arriving at the
-- same moment could both pass the check. This index makes the database refuse the second one.
-- Runs left "running" by a cut-off Worker are marked failed by the runner after 10 minutes,
-- before it inserts, so a dead run never blocks new ones for long.
-- Safe to re-run.

UPDATE public.index_runs
   SET status = 'failed',
       error = coalesce(error, 'Run did not finish (timed out or cancelled).'),
       finished_at = coalesce(finished_at, now())
 WHERE status = 'running'
   AND started_at < now() - interval '10 minutes';

CREATE UNIQUE INDEX IF NOT EXISTS index_runs_one_running
  ON public.index_runs ((true))
  WHERE status = 'running';
