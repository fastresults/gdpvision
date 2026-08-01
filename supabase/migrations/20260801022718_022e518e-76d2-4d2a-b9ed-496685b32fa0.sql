DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'persona_projects_status_check') THEN
    ALTER TABLE public.persona_projects DROP CONSTRAINT persona_projects_status_check;
  END IF;
  ALTER TABLE public.persona_projects
    ADD CONSTRAINT persona_projects_status_check
    CHECK (status IN ('active','archived','completed'));
END $$;