
CREATE POLICY "country-sources admin read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'country-sources' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "country-sources admin write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'country-sources' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "country-sources admin update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'country-sources' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'country-sources' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "country-sources admin delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'country-sources' AND public.has_role(auth.uid(), 'admin'::public.app_role));
