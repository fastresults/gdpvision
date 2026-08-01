CREATE TABLE public.programme_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.persona_projects(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  name text NOT NULL,
  email text,
  role text NOT NULL DEFAULT 'Project manager',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX programme_team_project_idx ON public.programme_team (project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.programme_team TO authenticated;
GRANT ALL ON public.programme_team TO service_role;

ALTER TABLE public.programme_team ENABLE ROW LEVEL SECURITY;

CREATE POLICY "country access manages programme_team"
  ON public.programme_team FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE TRIGGER trg_programme_team_updated
  BEFORE UPDATE ON public.programme_team
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.programme_milestones
  ADD COLUMN assignee_id uuid REFERENCES public.programme_team(id) ON DELETE SET NULL,
  ADD COLUMN blocked_reason text,
  ADD COLUMN notes jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.programme_deliverables
  ADD COLUMN assignee_id uuid REFERENCES public.programme_team(id) ON DELETE SET NULL,
  ADD COLUMN blocked_reason text,
  ADD COLUMN notes jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.programme_milestones SET status = 'planned'
  WHERE status NOT IN ('planned','in_progress','blocked','done','cancelled');
UPDATE public.programme_deliverables SET status = 'planned'
  WHERE status NOT IN ('planned','in_progress','blocked','done','cancelled');

ALTER TABLE public.programme_milestones
  ADD CONSTRAINT programme_milestones_status_chk
  CHECK (status IN ('planned','in_progress','blocked','done','cancelled'));

ALTER TABLE public.programme_deliverables
  ADD CONSTRAINT programme_deliverables_status_chk
  CHECK (status IN ('planned','in_progress','blocked','done','cancelled'));