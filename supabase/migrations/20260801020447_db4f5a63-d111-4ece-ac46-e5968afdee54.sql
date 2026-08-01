ALTER TABLE public.research_contacts
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.persona_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'accepted',
  ADD COLUMN IF NOT EXISTS persona_label text,
  ADD COLUMN IF NOT EXISTS fit_reason text,
  ADD COLUMN IF NOT EXISTS confidence text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS rejected_reason text,
  ADD COLUMN IF NOT EXISTS proposed_run_id text,
  ADD COLUMN IF NOT EXISTS suggested_for text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'research_contacts_status_check') THEN
    ALTER TABLE public.research_contacts
      ADD CONSTRAINT research_contacts_status_check
      CHECK (status IN ('proposed','accepted','rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS research_contacts_project_status_idx
  ON public.research_contacts (country_code, project_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS research_contacts_candidate_key
  ON public.research_contacts (project_id, lower(full_name), lower(coalesce(organisation, '')))
  WHERE project_id IS NOT NULL;

ALTER TABLE public.research_panels
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'survey';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'research_panels_kind_check') THEN
    ALTER TABLE public.research_panels
      ADD CONSTRAINT research_panels_kind_check
      CHECK (kind IN ('survey','focus_group'));
  END IF;
END $$;

ALTER TABLE public.persona_projects
  ADD COLUMN IF NOT EXISTS recruitment_brief jsonb;