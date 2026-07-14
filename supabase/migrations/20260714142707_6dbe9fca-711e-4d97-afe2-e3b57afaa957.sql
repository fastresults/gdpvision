
-- Phase 3 — Trust signals: grade downgrades + freshness view

CREATE TABLE public.grade_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  sector_code text,
  series_id uuid REFERENCES public.series(id) ON DELETE CASCADE,
  previous_grade char(1),
  new_grade char(1) NOT NULL,
  reason text,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX grade_alerts_country_idx ON public.grade_alerts(country_code, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.grade_alerts TO authenticated;
GRANT ALL ON public.grade_alerts TO service_role;
ALTER TABLE public.grade_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alerts readable to signed-in users"
  ON public.grade_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Alerts writable by admins and stewards"
  ON public.grade_alerts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'data_steward'));
CREATE POLICY "Alerts ack by admins and stewards"
  ON public.grade_alerts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'data_steward'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'data_steward'));

-- Trigger: when a series grade downgrades, log an alert row.
CREATE OR REPLACE FUNCTION public.log_series_grade_downgrade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rank_old int;
  rank_new int;
BEGIN
  IF NEW.confidence_grade IS NULL OR OLD.confidence_grade IS NULL THEN
    RETURN NEW;
  END IF;
  rank_old := CASE OLD.confidence_grade WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 WHEN 'D' THEN 4 ELSE 5 END;
  rank_new := CASE NEW.confidence_grade WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 WHEN 'D' THEN 4 ELSE 5 END;
  IF rank_new > rank_old THEN
    INSERT INTO public.grade_alerts (country_code, sector_code, series_id, previous_grade, new_grade, reason)
    VALUES (NEW.country_code, NEW.sector_code, NEW.id, OLD.confidence_grade, NEW.confidence_grade,
            'Auto: series grade downgraded');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER series_grade_downgrade_alert
  AFTER UPDATE OF confidence_grade ON public.series
  FOR EACH ROW EXECUTE FUNCTION public.log_series_grade_downgrade();

-- Freshness view: last observed period per series + age in days.
CREATE OR REPLACE VIEW public.series_freshness AS
SELECT
  s.id AS series_id,
  s.country_code,
  s.sector_code,
  s.metric,
  s.frequency,
  s.confidence_grade,
  MAX(sp.period) AS last_period,
  COUNT(sp.period) AS points_count,
  CASE WHEN MAX(sp.period) IS NULL THEN NULL
       ELSE (CURRENT_DATE - MAX(sp.period))::int END AS age_days
FROM public.series s
LEFT JOIN public.series_points sp ON sp.series_id = s.id
GROUP BY s.id;

GRANT SELECT ON public.series_freshness TO authenticated;
GRANT SELECT ON public.series_freshness TO service_role;
