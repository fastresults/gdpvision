CREATE TABLE public.items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('websites','presentations','docs')),
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  favicon_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO anon, authenticated;
GRANT ALL ON public.items TO service_role;

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read items" ON public.items FOR SELECT USING (true);
CREATE POLICY "Public can insert items" ON public.items FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update items" ON public.items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public can delete items" ON public.items FOR DELETE USING (true);

CREATE INDEX items_category_sort_idx ON public.items (category, sort_order);
