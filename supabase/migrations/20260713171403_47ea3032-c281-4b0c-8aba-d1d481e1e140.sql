CREATE OR REPLACE FUNCTION public.replace_country_sectors(_country_code text, _rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.country_sectors WHERE country_code = _country_code;
  INSERT INTO public.country_sectors (country_code, sector_code, share_pct, confidence_grade, source_ref)
    SELECT _country_code,
           (elem->>'sector_code')::text,
           NULLIF(elem->>'share_pct','')::numeric,
           COALESCE(NULLIF(elem->>'confidence_grade',''), 'C')::character(1),
           NULLIF(elem->>'source_ref','')::text
    FROM jsonb_array_elements(_rows) AS elem
    WHERE COALESCE(NULLIF(elem->>'share_pct','')::numeric, 0) > 0;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.replace_ministry_sectors(_country_code text, _rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.ministry_sectors ms USING public.ministries m
    WHERE ms.ministry_id = m.id AND m.country_code = _country_code;
  INSERT INTO public.ministry_sectors (ministry_id, sector_code, weight)
    SELECT m.id,
           (elem->>'sector_code')::text,
           COALESCE(NULLIF(elem->>'weight','')::numeric, 1.0)
    FROM jsonb_array_elements(_rows) AS elem
    JOIN public.ministries m ON m.country_code = _country_code AND m.slug = (elem->>'ministry_slug')::text;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END; $$;

REVOKE EXECUTE ON FUNCTION public.replace_country_sectors(text, jsonb) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.replace_ministry_sectors(text, jsonb) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.replace_country_sectors(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.replace_ministry_sectors(text, jsonb) TO service_role;