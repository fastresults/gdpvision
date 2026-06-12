CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  icon text NOT NULL DEFAULT 'Globe',
  behavior text NOT NULL CHECK (behavior IN ('website','pdf','docs','video')),
  is_builtin boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read categories"
ON public.categories FOR SELECT
USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.categories (slug, label, icon, behavior, is_builtin, sort_order) VALUES
  ('websites',      'Events',         'Globe',        'website', true, 10),
  ('presentations', 'GDP Sectors',    'Presentation', 'pdf',     true, 20),
  ('docs',          'Google Docs',    'FileText',     'docs',    true, 30),
  ('videos',        'Past Events',    'Film',         'video',   true, 40),
  ('brand',         'Brand Building', 'Sparkles',     'pdf',     true, 50);