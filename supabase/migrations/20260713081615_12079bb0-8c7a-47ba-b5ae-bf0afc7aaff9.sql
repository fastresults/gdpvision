-- 1. memory_objects: enforce normalized-title uniqueness at DB level.
CREATE UNIQUE INDEX IF NOT EXISTS memory_objects_dedup_idx
  ON public.memory_objects (
    scope_key,
    sector_code,
    kind,
    lower(btrim(regexp_replace(title, '\s+', ' ', 'g')))
  );

-- 2. country_source_documents: dedupe on content hash.
ALTER TABLE public.country_source_documents
  ADD COLUMN IF NOT EXISTS content_hash text;

-- Backfill existing rows with a sha256 of raw_text so the unique index can be built.
UPDATE public.country_source_documents
   SET content_hash = encode(extensions.digest(raw_text, 'sha256'), 'hex')
 WHERE content_hash IS NULL AND raw_text IS NOT NULL;

-- Collapse any pre-existing duplicates (same source + same hash) so the unique index can build.
-- Keep the oldest row per (source, hash); delete the rest along with their chunks.
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY country_source_id, content_hash ORDER BY fetched_at ASC, id ASC) AS rn
    FROM public.country_source_documents
   WHERE content_hash IS NOT NULL
),
dupes AS (SELECT id FROM ranked WHERE rn > 1)
DELETE FROM public.country_source_documents WHERE id IN (SELECT id FROM dupes);

CREATE UNIQUE INDEX IF NOT EXISTS country_source_documents_content_dedup_idx
  ON public.country_source_documents (country_source_id, content_hash)
  WHERE content_hash IS NOT NULL;