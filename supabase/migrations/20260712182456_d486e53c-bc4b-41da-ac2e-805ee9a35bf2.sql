
CREATE OR REPLACE FUNCTION public.country_chunks_search(
  _country_code text,
  _query_embedding text,
  _limit int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  chunk_index int,
  content text,
  distance float,
  source_url text,
  source_title text,
  source_org text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    c.id,
    c.chunk_index,
    c.content,
    (c.embedding <=> _query_embedding::extensions.vector) AS distance,
    s.url AS source_url,
    s.title AS source_title,
    s.org AS source_org
  FROM public.country_source_chunks c
  JOIN public.country_source_documents d ON d.id = c.document_id
  JOIN public.country_sources s ON s.id = d.country_source_id
  WHERE c.country_code = _country_code
    AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> _query_embedding::extensions.vector
  LIMIT _limit;
$$;

GRANT EXECUTE ON FUNCTION public.country_chunks_search(text, text, int) TO authenticated, service_role;
