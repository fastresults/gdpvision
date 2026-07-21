
-- 1) persona_projects
CREATE TABLE IF NOT EXISTS public.persona_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  title text NOT NULL,
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','private')),
  owner_country_code text,
  uploaded_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.persona_projects TO authenticated;
GRANT ALL ON public.persona_projects TO service_role;
ALTER TABLE public.persona_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "persona_projects read" ON public.persona_projects
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));

CREATE POLICY "persona_projects write" ON public.persona_projects
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));

CREATE TRIGGER persona_projects_updated_at BEFORE UPDATE ON public.persona_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) project_id columns on downstream tables
ALTER TABLE public.persona_study_drafts
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.persona_projects(id) ON DELETE CASCADE;
ALTER TABLE public.studies
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.persona_projects(id) ON DELETE SET NULL;
ALTER TABLE public.study_program_reports
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.persona_projects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS persona_study_drafts_project_idx ON public.persona_study_drafts(project_id);
CREATE INDEX IF NOT EXISTS studies_project_idx ON public.studies(project_id);
CREATE INDEX IF NOT EXISTS study_program_reports_project_idx ON public.study_program_reports(project_id);

-- 3) Backfill: one Default project per country that has any personas data.
INSERT INTO public.persona_projects (country_code, title, slug, status, visibility)
SELECT DISTINCT c.country_code, 'Default project', 'default', 'active', 'public'
FROM (
  SELECT country_code FROM public.persona_study_drafts WHERE country_code IS NOT NULL
  UNION
  SELECT country_code FROM public.studies WHERE country_code IS NOT NULL
  UNION
  SELECT country_code FROM public.study_program_reports WHERE country_code IS NOT NULL
) c
ON CONFLICT (country_code, slug) DO NOTHING;

UPDATE public.persona_study_drafts d
   SET project_id = p.id
  FROM public.persona_projects p
 WHERE d.project_id IS NULL
   AND p.country_code = d.country_code
   AND p.slug = 'default';

UPDATE public.studies s
   SET project_id = p.id
  FROM public.persona_projects p
 WHERE s.project_id IS NULL
   AND p.country_code = s.country_code
   AND p.slug = 'default';

UPDATE public.study_program_reports r
   SET project_id = p.id
  FROM public.persona_projects p
 WHERE r.project_id IS NULL
   AND p.country_code = r.country_code
   AND p.slug = 'default';

-- 4) Swap uniqueness on study_program_reports from country to project.
ALTER TABLE public.study_program_reports DROP CONSTRAINT IF EXISTS study_program_reports_country_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS study_program_reports_project_unique
  ON public.study_program_reports(project_id) WHERE project_id IS NOT NULL;
