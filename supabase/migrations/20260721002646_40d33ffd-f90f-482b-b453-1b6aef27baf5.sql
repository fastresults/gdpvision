
ALTER TABLE public.study_reports ADD COLUMN IF NOT EXISTS context jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.study_program_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL UNIQUE,
  brief_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  studies_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary_md text NOT NULL DEFAULT '',
  sections jsonb NOT NULL DEFAULT '{}'::jsonb,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_program_reports TO authenticated;
GRANT ALL ON public.study_program_reports TO service_role;
ALTER TABLE public.study_program_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_program_reports read"
  ON public.study_program_reports FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_country_access(auth.uid(), country_code)
  );

CREATE POLICY "study_program_reports write"
  ON public.study_program_reports FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_country_access(auth.uid(), country_code)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_country_access(auth.uid(), country_code)
  );

CREATE TRIGGER study_program_reports_updated_at BEFORE UPDATE ON public.study_program_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
