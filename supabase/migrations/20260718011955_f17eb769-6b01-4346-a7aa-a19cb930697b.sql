
DROP FUNCTION IF EXISTS public.country_chunks_search(text, text, integer);

CREATE OR REPLACE FUNCTION public.country_chunks_search(_country_code text, _query_embedding text, _limit integer DEFAULT 8)
 RETURNS TABLE(id uuid, chunk_index integer, content text, distance double precision, source_url text, source_title text, source_org text, source_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  SELECT
    c.id,
    c.chunk_index,
    c.content,
    (c.embedding <=> _query_embedding::extensions.vector) AS distance,
    s.url AS source_url,
    s.title AS source_title,
    s.org AS source_org,
    s.id AS source_id
  FROM public.country_source_chunks c
  JOIN public.country_source_documents d ON d.id = c.document_id
  JOIN public.country_sources s ON s.id = d.country_source_id
  WHERE c.country_code = _country_code
    AND c.embedding IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_country_access(auth.uid(), _country_code)
    )
  ORDER BY c.embedding <=> _query_embedding::extensions.vector
  LIMIT _limit;
$function$;

GRANT EXECUTE ON FUNCTION public.country_chunks_search(text, text, integer) TO authenticated;
