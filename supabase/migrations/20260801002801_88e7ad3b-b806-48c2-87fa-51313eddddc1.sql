ALTER TABLE public.persona_projects
  ADD COLUMN IF NOT EXISTS track text NOT NULL DEFAULT 'synthetic',
  ADD COLUMN IF NOT EXISTS track_chosen_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'persona_projects_track_check'
  ) THEN
    ALTER TABLE public.persona_projects
      ADD CONSTRAINT persona_projects_track_check
      CHECK (track IN ('synthetic', 'field', 'blended'));
  END IF;
END $$;