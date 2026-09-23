CREATE TABLE public.sovereign_eye_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  layers jsonb NOT NULL DEFAULT '[]'::jsonb,
  camera jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public')),
  share_token text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sovereign_eye_scenes TO authenticated;
GRANT ALL ON public.sovereign_eye_scenes TO service_role;
ALTER TABLE public.sovereign_eye_scenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "country access reads sovereign eye scenes"
  ON public.sovereign_eye_scenes
  FOR SELECT
  TO authenticated
  USING (public.has_country_access(auth.uid(), country_code));
CREATE POLICY "country access creates sovereign eye scenes"
  ON public.sovereign_eye_scenes
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_country_access(auth.uid(), country_code));
CREATE POLICY "scene owners or admins update sovereign eye scenes"
  ON public.sovereign_eye_scenes
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));
CREATE POLICY "scene owners or admins delete sovereign eye scenes"
  ON public.sovereign_eye_scenes
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE UNIQUE INDEX sovereign_eye_scenes_share_token_key
  ON public.sovereign_eye_scenes (share_token)
  WHERE share_token IS NOT NULL;
CREATE INDEX sovereign_eye_scenes_country_updated_idx
  ON public.sovereign_eye_scenes (country_code, updated_at DESC);
CREATE TRIGGER sovereign_eye_scenes_updated
  BEFORE UPDATE ON public.sovereign_eye_scenes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();