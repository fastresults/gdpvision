-- 0016 · Digital Government Studio: default platform name
--
-- A PRD whose scope has no platform name is named for the government of its
-- country ("Government of Antigua and Barbuda"). Runs as the service role,
-- so the governance guard treats it as a system edit: no approval is
-- reopened; the history records egov_prd.edited.

UPDATE public.egov_prds p
SET scope = jsonb_set(COALESCE(p.scope, '{}'::jsonb), '{platform_name}',
                      to_jsonb('Government of ' || c.name), true)
FROM public.countries c
WHERE c.code = p.country_code
  AND COALESCE(btrim(p.scope->>'platform_name'), '') = '';
