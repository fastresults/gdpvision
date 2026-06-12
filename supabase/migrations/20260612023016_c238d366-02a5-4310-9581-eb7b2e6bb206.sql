
-- 1) Categories: add media_modes for gallery behavior
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS media_modes text[] NOT NULL DEFAULT '{}'::text[];

-- 2) Galleries
CREATE TABLE IF NOT EXISTS public.galleries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  label text NOT NULL,
  cover_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.galleries TO authenticated;
GRANT SELECT ON public.galleries TO anon;
GRANT ALL ON public.galleries TO service_role;

ALTER TABLE public.galleries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read galleries"
  ON public.galleries FOR SELECT
  USING (true);

CREATE TRIGGER update_galleries_updated_at
  BEFORE UPDATE ON public.galleries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS galleries_category_sort_idx
  ON public.galleries (category_id, sort_order);

-- 3) Gallery items
CREATE TABLE IF NOT EXISTS public.gallery_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gallery_id uuid NOT NULL REFERENCES public.galleries(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('video','image')),
  media_asset_id uuid REFERENCES public.media_assets(id) ON DELETE SET NULL,
  storage_path text,
  thumbnail_url text,
  label text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gallery_items TO authenticated;
GRANT SELECT ON public.gallery_items TO anon;
GRANT ALL ON public.gallery_items TO service_role;

ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read gallery_items"
  ON public.gallery_items FOR SELECT
  USING (true);

CREATE TRIGGER update_gallery_items_updated_at
  BEFORE UPDATE ON public.gallery_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS gallery_items_gallery_sort_idx
  ON public.gallery_items (gallery_id, sort_order);
