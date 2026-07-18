
CREATE TABLE public.cabinet_brief_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  brief_md text NOT NULL,
  headline text,
  posture jsonb NOT NULL DEFAULT '{}'::jsonb,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX cabinet_brief_cache_country_idx ON public.cabinet_brief_cache (country_code, generated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cabinet_brief_cache TO authenticated;
GRANT ALL ON public.cabinet_brief_cache TO service_role;

ALTER TABLE public.cabinet_brief_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cabinet_brief_cache read for country members"
  ON public.cabinet_brief_cache FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_country_access(auth.uid(), country_code));

CREATE POLICY "cabinet_brief_cache write for country members"
  ON public.cabinet_brief_cache FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_country_access(auth.uid(), country_code));
