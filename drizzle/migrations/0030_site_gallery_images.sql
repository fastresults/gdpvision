CREATE TABLE public.site_gallery_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text NOT NULL UNIQUE,
  url text NOT NULL,
  caption text,
  alt text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_gallery_images TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_gallery_images TO authenticated;
GRANT ALL ON public.site_gallery_images TO service_role;
ALTER TABLE public.site_gallery_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view gallery" ON public.site_gallery_images FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage gallery" ON public.site_gallery_images FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read site-gallery" ON storage.objects FOR SELECT USING (bucket_id = 'site-gallery');
CREATE POLICY "Admins write site-gallery" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'site-gallery' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete site-gallery" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'site-gallery' AND public.has_role(auth.uid(), 'admin'));