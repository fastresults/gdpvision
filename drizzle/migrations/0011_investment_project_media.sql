ALTER TABLE public.investment_projects ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.investment_project_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.investment_projects(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('image','document')),
  title text NOT NULL,
  caption text,
  storage_path text NOT NULL,
  mime text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  is_cover boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, storage_path)
);
CREATE INDEX IF NOT EXISTS investment_project_media_project_idx ON public.investment_project_media(project_id, kind, sort);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_project_media TO authenticated;
GRANT ALL ON public.investment_project_media TO service_role;
ALTER TABLE public.investment_project_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Country members read project media" ON public.investment_project_media
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_country_access(auth.uid(), country_code));
CREATE POLICY "Admins and approvers manage project media" ON public.investment_project_media
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.can_approve_investment(auth.uid(), country_code))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.can_approve_investment(auth.uid(), country_code));