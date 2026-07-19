-- Allow country members (and admins via has_country_access) to persist
-- generated sector dossier briefs so subsequent loads are instant.
CREATE POLICY "Country members write sector briefs"
  ON public.sector_dossier_briefs
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE POLICY "Country members update sector briefs"
  ON public.sector_dossier_briefs
  FOR UPDATE
  TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));