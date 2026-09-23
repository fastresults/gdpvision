GRANT SELECT ON public.sovereign_eye_scenes TO anon;
CREATE POLICY "public shared sovereign eye scenes are readable"
  ON public.sovereign_eye_scenes
  FOR SELECT
  TO anon
  USING (visibility = 'public' AND share_token IS NOT NULL);