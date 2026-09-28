ALTER TABLE public.country_manifestos
  ADD COLUMN IF NOT EXISTS thumbnail_path text,
  ADD COLUMN IF NOT EXISTS thumbnail_source text NOT NULL DEFAULT 'placeholder',
  ADD COLUMN IF NOT EXISTS thumbnail_updated_at timestamptz;
ALTER TABLE public.country_manifestos
  ADD CONSTRAINT country_manifestos_thumbnail_source_chk
  CHECK (thumbnail_source IN ('uploaded','first_page','placeholder'));
ALTER TABLE public.country_manifestos
  ADD CONSTRAINT country_manifestos_thumbnail_path_chk
  CHECK (thumbnail_source = 'placeholder' OR thumbnail_path IS NOT NULL);