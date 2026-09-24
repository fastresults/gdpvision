CREATE OR REPLACE FUNCTION public.is_admin_or_steward(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'data_steward')
$$;

CREATE SCHEMA IF NOT EXISTS internal;
REVOKE ALL ON SCHEMA internal FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS internal.hook_secrets (name text PRIMARY KEY, secret text NOT NULL);
INSERT INTO internal.hook_secrets(name, secret)
VALUES ('cron', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_hook_secret(_secret text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, internal AS $$
  SELECT EXISTS (SELECT 1 FROM internal.hook_secrets WHERE name = 'cron' AND secret = _secret AND length(_secret) > 0)
$$;
REVOKE ALL ON FUNCTION public.verify_hook_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_hook_secret(text) TO service_role;

DO $$
DECLARE j record; new_cmd text;
BEGIN
  FOR j IN SELECT jobid, command FROM cron.job WHERE command LIKE '%/api/public/hooks/%' LOOP
    new_cmd := regexp_replace(j.command,
      'headers:=''[^'']*''::jsonb',
      'headers:=jsonb_build_object(''Content-Type'',''application/json'',''x-hook-secret'',(SELECT secret FROM internal.hook_secrets WHERE name=''cron''))');
    PERFORM cron.alter_job(j.jobid, command := new_cmd);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "invitations lookup by token" ON public.invitations;

DROP POLICY IF EXISTS "Profiles readable by authenticated users" ON public.profiles;
CREATE POLICY "Profiles readable by self or admin" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "instance_config_read_authenticated" ON public.instance_config;
CREATE POLICY "instance_config_read_counsel_limits" ON public.instance_config FOR SELECT TO authenticated
  USING (key IN ('counsel.limits','counsel.deep_limits') OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated read flows" ON public.country_capital_flows;

DROP POLICY IF EXISTS "narrative_harvest_runs_read" ON public.narrative_harvest_runs;
CREATE POLICY "narrative_harvest_runs_read" ON public.narrative_harvest_runs FOR SELECT TO authenticated USING (public.is_admin_or_steward(auth.uid()));
DROP POLICY IF EXISTS "cadence_closes_read" ON public.cadence_closes;
CREATE POLICY "cadence_closes_read" ON public.cadence_closes FOR SELECT TO authenticated USING (public.is_admin_or_steward(auth.uid()));
DROP POLICY IF EXISTS "exports_documents_read" ON public.exports_documents;
CREATE POLICY "exports_documents_read" ON public.exports_documents FOR SELECT TO authenticated USING (public.is_admin_or_steward(auth.uid()) OR rendered_by = auth.uid());
DROP POLICY IF EXISTS "narrative_lineage readable by authenticated" ON public.narrative_lineage;
CREATE POLICY "narrative_lineage readable" ON public.narrative_lineage FOR SELECT TO authenticated USING (public.is_admin_or_steward(auth.uid()) OR created_by = auth.uid());
DROP POLICY IF EXISTS "dossier_questions readable by authenticated" ON public.dossier_questions;
CREATE POLICY "dossier_questions readable" ON public.dossier_questions FOR SELECT TO authenticated USING (public.is_admin_or_steward(auth.uid()) OR created_by = auth.uid());
DROP POLICY IF EXISTS "Audit readable by authenticated users" ON public.data_revisions;
CREATE POLICY "Audit readable by stewards" ON public.data_revisions FOR SELECT TO authenticated USING (public.is_admin_or_steward(auth.uid()));

DROP POLICY IF EXISTS "kpi_snapshots_read" ON public.kpi_snapshots;
CREATE POLICY "kpi_snapshots_read" ON public.kpi_snapshots FOR SELECT TO authenticated USING (
  public.is_admin_or_steward(auth.uid()) OR EXISTS (SELECT 1 FROM public.kpis k WHERE k.id = kpi_id AND public.has_country_access(auth.uid(), k.country_code)));
DROP POLICY IF EXISTS "Authenticated can read reconciliation notes" ON public.reconciliation_notes;
CREATE POLICY "Reconciliation notes by country access" ON public.reconciliation_notes FOR SELECT TO authenticated USING (public.is_admin_or_steward(auth.uid()) OR public.has_country_access(auth.uid(), country_code));
DROP POLICY IF EXISTS "Alerts readable to signed-in users" ON public.grade_alerts;
CREATE POLICY "Alerts readable by country access" ON public.grade_alerts FOR SELECT TO authenticated USING (public.is_admin_or_steward(auth.uid()) OR public.has_country_access(auth.uid(), country_code));
DROP POLICY IF EXISTS "Exposure index readable by authenticated users" ON public.exposure_index;
CREATE POLICY "Exposure index by country access" ON public.exposure_index FOR SELECT TO authenticated USING (public.is_admin_or_steward(auth.uid()) OR public.has_country_access(auth.uid(), country_code));
DROP POLICY IF EXISTS "Authenticated can read authorized domains" ON public.country_authorized_domains;
CREATE POLICY "Authorized domains by country access" ON public.country_authorized_domains FOR SELECT TO authenticated USING (public.has_country_access(auth.uid(), country_code));
DROP POLICY IF EXISTS "ministries readable by authenticated" ON public.ministries;
CREATE POLICY "ministries readable by country access" ON public.ministries FOR SELECT TO authenticated USING (public.is_admin_or_steward(auth.uid()) OR public.has_country_access(auth.uid(), country_code));
DROP POLICY IF EXISTS "ministry_sectors readable by authenticated" ON public.ministry_sectors;
CREATE POLICY "ministry_sectors readable by country access" ON public.ministry_sectors FOR SELECT TO authenticated USING (
  public.is_admin_or_steward(auth.uid()) OR EXISTS (SELECT 1 FROM public.ministries m WHERE m.id = ministry_id AND public.has_country_access(auth.uid(), m.country_code)));
DROP POLICY IF EXISTS "levers readable by authenticated" ON public.levers;
CREATE POLICY "levers readable by country access" ON public.levers FOR SELECT TO authenticated USING (public.is_admin_or_steward(auth.uid()) OR country_code IS NULL OR public.has_country_access(auth.uid(), country_code));
DROP POLICY IF EXISTS "Authenticated can read health checks" ON public.source_health_checks;
CREATE POLICY "Health checks by country access" ON public.source_health_checks FOR SELECT TO authenticated USING (public.is_admin_or_steward(auth.uid()) OR public.has_country_access(auth.uid(), country_code));

DROP POLICY IF EXISTS "Public can read items" ON public.items;
DROP POLICY IF EXISTS "Public can read galleries" ON public.galleries;
DROP POLICY IF EXISTS "Public can read gallery_items" ON public.gallery_items;
DROP POLICY IF EXISTS "Public can read idle_images" ON public.idle_images;
DROP POLICY IF EXISTS "Public can read categories" ON public.categories;
DROP POLICY IF EXISTS "Public can read settings" ON public.app_settings;
DROP POLICY IF EXISTS "Public can read media_assets" ON public.media_assets;

DROP POLICY IF EXISTS "Public read thumbnails" ON storage.objects;
DROP POLICY IF EXISTS "Public read media-library" ON storage.objects;
DROP POLICY IF EXISTS "Public read event-videos" ON storage.objects;
