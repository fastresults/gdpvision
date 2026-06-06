CREATE TABLE public.media_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('image','video','pdf','document')),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.media_assets TO anon, authenticated;
GRANT ALL ON public.media_assets TO service_role;

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read media_assets"
  ON public.media_assets FOR SELECT
  TO public
  USING (true);

ALTER TABLE public.items
  ADD COLUMN favicon_asset_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL;

CREATE POLICY "Public read media-library"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'media-library');