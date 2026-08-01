CREATE TABLE IF NOT EXISTS public.field_ingest_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  wave_id text,
  collection_id uuid REFERENCES public.field_collections(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.field_sessions(id) ON DELETE SET NULL,
  instrument_id uuid REFERENCES public.field_instruments(id) ON DELETE SET NULL,
  instrument_version integer,
  kind text NOT NULL DEFAULT 'tabular',
  status text NOT NULL DEFAULT 'staged',
  filename text,
  storage_path text,
  mime_type text,
  file_hash text,
  source text NOT NULL DEFAULT 'upload',
  mapping jsonb NOT NULL DEFAULT '[]'::jsonb,
  staged jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  row_count integer NOT NULL DEFAULT 0,
  mapped_count integer NOT NULL DEFAULT 0,
  flagged_count integer NOT NULL DEFAULT 0,
  unmapped_count integer NOT NULL DEFAULT 0,
  committed_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  committed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_ingest_batches TO authenticated;
GRANT ALL ON public.field_ingest_batches TO service_role;

ALTER TABLE public.field_ingest_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Country members manage field ingest batches"
ON public.field_ingest_batches
FOR ALL
TO authenticated
USING (public.has_country_access(auth.uid(), country_code))
WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE INDEX IF NOT EXISTS field_ingest_batches_study_idx ON public.field_ingest_batches (study_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS field_ingest_batches_hash_idx ON public.field_ingest_batches (study_id, file_hash) WHERE file_hash IS NOT NULL;

CREATE TRIGGER update_field_ingest_batches_updated_at
BEFORE UPDATE ON public.field_ingest_batches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.field_responses
  ADD COLUMN IF NOT EXISTS instrument_version integer,
  ADD COLUMN IF NOT EXISTS completion_rate numeric,
  ADD COLUMN IF NOT EXISTS ingest_batch_id uuid REFERENCES public.field_ingest_batches(id) ON DELETE SET NULL;

ALTER TABLE public.field_collections
  ADD COLUMN IF NOT EXISTS open_token text,
  ADD COLUMN IF NOT EXISTS open_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS instrument_version integer;

CREATE UNIQUE INDEX IF NOT EXISTS field_collections_open_token_idx ON public.field_collections (open_token) WHERE open_token IS NOT NULL;