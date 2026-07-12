
REVOKE EXECUTE ON FUNCTION public.country_chunks_search(text, text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.country_chunks_search(text, text, int) TO service_role;
