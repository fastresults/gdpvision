
ALTER TABLE public.comms_artifacts
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS comms_artifacts_body_trgm ON public.comms_artifacts USING gin (body gin_trgm_ops);
CREATE INDEX IF NOT EXISTS comms_artifacts_title_trgm ON public.comms_artifacts USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS comms_artifacts_tags_gin ON public.comms_artifacts USING gin (tags);
CREATE INDEX IF NOT EXISTS comms_artifacts_scope_updated ON public.comms_artifacts (scope_key, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.comms_artifact_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id uuid NOT NULL REFERENCES public.comms_artifacts(id) ON DELETE CASCADE,
  scope_key text NOT NULL,
  body text NOT NULL,
  title text,
  editor_id uuid,
  edited_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS comms_rev_artifact_time ON public.comms_artifact_revisions (artifact_id, edited_at DESC);

GRANT SELECT, INSERT ON public.comms_artifact_revisions TO authenticated;
GRANT ALL ON public.comms_artifact_revisions TO service_role;

ALTER TABLE public.comms_artifact_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "revisions read same scope as artifact" ON public.comms_artifact_revisions;
CREATE POLICY "revisions read same scope as artifact"
  ON public.comms_artifact_revisions FOR SELECT
  USING (
    scope_key = 'REGIONAL'
    OR EXISTS (
      SELECT 1 FROM public.instance_bindings ib
      WHERE ib.user_id = auth.uid() AND ib.country_code = comms_artifact_revisions.scope_key
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "revisions insert by comms role" ON public.comms_artifact_revisions;
CREATE POLICY "revisions insert by comms role"
  ON public.comms_artifact_revisions FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'comms_director'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE OR REPLACE FUNCTION public.comms_artifact_snapshot_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.body IS DISTINCT FROM NEW.body THEN
    INSERT INTO public.comms_artifact_revisions (artifact_id, scope_key, body, title, editor_id)
    VALUES (OLD.id, OLD.scope_key, OLD.body, OLD.title, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comms_artifact_snapshot_on_update ON public.comms_artifacts;
CREATE TRIGGER comms_artifact_snapshot_on_update
  BEFORE UPDATE ON public.comms_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.comms_artifact_snapshot_revision();
