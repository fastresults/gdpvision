
CREATE POLICY "opposition_intel_country_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'opposition-intel'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_country_access(auth.uid(), split_part(name, '/', 1))
    )
  );

CREATE POLICY "opposition_intel_country_write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'opposition-intel'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_country_access(auth.uid(), split_part(name, '/', 1))
    )
  );

CREATE POLICY "opposition_intel_country_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'opposition-intel'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_country_access(auth.uid(), split_part(name, '/', 1))
    )
  );

CREATE POLICY "opposition_intel_country_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'opposition-intel'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_country_access(auth.uid(), split_part(name, '/', 1))
    )
  );
