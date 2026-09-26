ALTER TABLE public.country_source_documents
  ADD COLUMN IF NOT EXISTS page_url text,
  ADD COLUMN IF NOT EXISTS page_title text,
  ADD COLUMN IF NOT EXISTS page_key text;

UPDATE public.country_source_documents d
   SET page_url = s.url,
       page_key = lower(regexp_replace(regexp_replace(s.url, '#.*$', ''), '/+$', ''))
  FROM public.country_sources s
 WHERE s.id = d.country_source_id AND d.page_key IS NULL;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY country_source_id, page_key ORDER BY fetched_at DESC, id) rn
    FROM public.country_source_documents WHERE page_key IS NOT NULL
)
UPDATE public.country_source_documents d SET page_key = d.page_key || '#legacy-' || d.id
  FROM ranked r WHERE r.id = d.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS country_source_documents_page_key_idx
  ON public.country_source_documents (country_source_id, page_key)
  WHERE page_key IS NOT NULL;

ALTER TABLE public.country_sources
  ADD COLUMN IF NOT EXISTS crawl_status text,
  ADD COLUMN IF NOT EXISTS crawl_job_id text,
  ADD COLUMN IF NOT EXISTS crawl_progress jsonb NOT NULL DEFAULT '{}'::jsonb;