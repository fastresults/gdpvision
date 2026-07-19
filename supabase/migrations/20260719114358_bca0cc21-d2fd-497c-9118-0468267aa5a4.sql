ALTER TABLE public.sector_dossier_briefs
  ADD COLUMN IF NOT EXISTS input_fingerprint text,
  ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1;