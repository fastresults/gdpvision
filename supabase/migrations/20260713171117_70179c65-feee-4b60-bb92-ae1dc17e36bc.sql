REVOKE EXECUTE ON FUNCTION public.replace_country_sectors(text, jsonb) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.replace_ministry_sectors(text, jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.replace_country_sectors(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.replace_ministry_sectors(text, jsonb) TO service_role;