-- News scan controls: on/off switch for automatic scans, daily AI request limit,
-- per-scan limit and a persisted pause when AI credits or access are blocked.
CREATE TABLE public.press_scan_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  auto_enabled boolean NOT NULL DEFAULT false,
  daily_ai_limit integer NOT NULL DEFAULT 500 CHECK (daily_ai_limit BETWEEN 0 AND 20000),
  per_run_limit integer NOT NULL DEFAULT 40 CHECK (per_run_limit BETWEEN 1 AND 500),
  paused_reason text,
  paused_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.press_scan_settings TO authenticated;
GRANT ALL ON public.press_scan_settings TO service_role;
ALTER TABLE public.press_scan_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read press scan settings" ON public.press_scan_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.press_scan_settings (id, auto_enabled) VALUES (true, false)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.press_scan_ai_usage (
  day date PRIMARY KEY,
  calls integer NOT NULL DEFAULT 0,
  skipped_offtopic integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.press_scan_ai_usage TO authenticated;
GRANT ALL ON public.press_scan_ai_usage TO service_role;
ALTER TABLE public.press_scan_ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read press scan usage" ON public.press_scan_ai_usage
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Atomically take up to _n AI requests from today's (UTC) allowance; returns how many were granted.
CREATE OR REPLACE FUNCTION public.claim_press_ai_calls(_n integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date := (now() AT TIME ZONE 'utc')::date;
  lim integer;
  used integer;
  granted integer;
BEGIN
  SELECT daily_ai_limit INTO lim FROM public.press_scan_settings WHERE id;
  INSERT INTO public.press_scan_ai_usage (day) VALUES (d) ON CONFLICT (day) DO NOTHING;
  SELECT calls INTO used FROM public.press_scan_ai_usage WHERE day = d FOR UPDATE;
  granted := GREATEST(0, LEAST(GREATEST(_n, 0), COALESCE(lim, 0) - used));
  UPDATE public.press_scan_ai_usage SET calls = calls + granted, updated_at = now() WHERE day = d;
  RETURN granted;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_press_ai_calls(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_press_ai_calls(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.note_press_offtopic(_n integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE d date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  INSERT INTO public.press_scan_ai_usage (day, skipped_offtopic) VALUES (d, GREATEST(_n, 0))
  ON CONFLICT (day) DO UPDATE SET skipped_offtopic = public.press_scan_ai_usage.skipped_offtopic + GREATEST(_n, 0), updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.note_press_offtopic(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.note_press_offtopic(integer) TO service_role;

-- Admin-only: change scan settings. Turning automatic scans on/off also
-- switches the three scheduled news-scan jobs, so "off" means no requests at all.
CREATE OR REPLACE FUNCTION public.update_press_scan_settings(
  _auto_enabled boolean DEFAULT NULL,
  _daily_ai_limit integer DEFAULT NULL,
  _per_run_limit integer DEFAULT NULL,
  _clear_pause boolean DEFAULT false
)
RETURNS public.press_scan_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  j record;
  result public.press_scan_settings;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change the news scan settings';
  END IF;
  UPDATE public.press_scan_settings SET
    auto_enabled = COALESCE(_auto_enabled, auto_enabled),
    daily_ai_limit = COALESCE(_daily_ai_limit, daily_ai_limit),
    per_run_limit = COALESCE(_per_run_limit, per_run_limit),
    paused_reason = CASE WHEN _clear_pause THEN NULL ELSE paused_reason END,
    paused_at = CASE WHEN _clear_pause THEN NULL ELSE paused_at END,
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id
  RETURNING * INTO result;
  IF _auto_enabled IS NOT NULL THEN
    FOR j IN SELECT jobid FROM cron.job
      WHERE jobname IN ('narrative-press-tick-hourly', 'narrative-press-tick-morning', 'narrative-press-tick-evening')
    LOOP
      PERFORM cron.alter_job(j.jobid, active := _auto_enabled);
    END LOOP;
  END IF;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.update_press_scan_settings(boolean, integer, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_press_scan_settings(boolean, integer, integer, boolean) TO authenticated, service_role;