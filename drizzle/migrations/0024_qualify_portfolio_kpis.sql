ALTER TABLE public.kpis
  ADD COLUMN IF NOT EXISTS baseline_period text,
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'up',
  ADD COLUMN IF NOT EXISTS target_basis text,
  ADD COLUMN IF NOT EXISTS evidence_url text,
  ADD COLUMN IF NOT EXISTS warning_tolerance_pct numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS critical_tolerance_pct numeric NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS qualification_notes text;

ALTER TABLE public.kpis
  DROP CONSTRAINT IF EXISTS kpis_direction_check;
ALTER TABLE public.kpis
  ADD CONSTRAINT kpis_direction_check CHECK (direction IN ('up','down','flat')) NOT VALID;

ALTER TABLE public.kpis
  DROP CONSTRAINT IF EXISTS kpis_target_basis_check;
ALTER TABLE public.kpis
  ADD CONSTRAINT kpis_target_basis_check CHECK (target_basis IS NULL OR target_basis IN ('policy_commitment','peer_benchmark','approved_scenario')) NOT VALID;

ALTER TABLE public.kpis
  DROP CONSTRAINT IF EXISTS kpis_tolerances_check;
ALTER TABLE public.kpis
  ADD CONSTRAINT kpis_tolerances_check CHECK (warning_tolerance_pct >= 0 AND critical_tolerance_pct >= warning_tolerance_pct) NOT VALID;

ALTER TABLE public.kpis
  DROP CONSTRAINT IF EXISTS kpis_verification_status_check;
ALTER TABLE public.kpis
  ADD CONSTRAINT kpis_verification_status_check CHECK (verification_status IN ('draft','submitted','qualified','returned')) NOT VALID;

CREATE TABLE IF NOT EXISTS public.kpi_qualification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id uuid NOT NULL REFERENCES public.kpis(id) ON DELETE CASCADE,
  previous_status text,
  next_status text NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text
);

GRANT SELECT, INSERT ON public.kpi_qualification_history TO authenticated;
GRANT ALL ON public.kpi_qualification_history TO service_role;
ALTER TABLE public.kpi_qualification_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kpi qualification history read" ON public.kpi_qualification_history;
CREATE POLICY "kpi qualification history read" ON public.kpi_qualification_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.kpis k
      WHERE k.id = kpi_qualification_history.kpi_id
        AND public.has_country_access(auth.uid(), k.country_code)
    )
  );

DROP POLICY IF EXISTS "kpi qualification history insert" ON public.kpi_qualification_history;
CREATE POLICY "kpi qualification history insert" ON public.kpi_qualification_history
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'cabinet_secretary')
    OR public.has_role(auth.uid(), 'data_steward')
  );

CREATE OR REPLACE FUNCTION public.log_kpi_qualification_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.verification_status IS DISTINCT FROM NEW.verification_status THEN
    INSERT INTO public.kpi_qualification_history (
      kpi_id,
      previous_status,
      next_status,
      changed_by,
      note
    ) VALUES (
      NEW.id,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.verification_status END,
      NEW.verification_status,
      auth.uid(),
      NEW.qualification_notes
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kpis_qualification_history ON public.kpis;
CREATE TRIGGER kpis_qualification_history
AFTER INSERT OR UPDATE OF verification_status ON public.kpis
FOR EACH ROW EXECUTE FUNCTION public.log_kpi_qualification_change();

GRANT EXECUTE ON FUNCTION public.log_kpi_qualification_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_kpi_qualification_change() TO service_role;