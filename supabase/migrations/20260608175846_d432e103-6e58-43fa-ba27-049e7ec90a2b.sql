CREATE TABLE public.idle_images (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  media_asset_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  image_url text NOT NULL,
  caption text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.idle_images TO anon, authenticated;
GRANT ALL ON public.idle_images TO service_role;

ALTER TABLE public.idle_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read idle_images"
  ON public.idle_images FOR SELECT
  USING (true);

CREATE INDEX idle_images_sort_order_idx ON public.idle_images(sort_order);