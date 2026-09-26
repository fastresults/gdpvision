UPDATE public.egov_prds p
SET scope = jsonb_set(COALESCE(p.scope, '{}'::jsonb), '{platform_name}',
                      to_jsonb('Government of ' || c.name), true)
FROM public.countries c
WHERE c.code = p.country_code
  AND COALESCE(btrim(p.scope->>'platform_name'), '') = '';