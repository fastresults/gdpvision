ALTER TABLE public.items
  DROP CONSTRAINT IF EXISTS items_category_check;

ALTER TABLE public.items
  ADD CONSTRAINT items_category_check
  CHECK (category = ANY (ARRAY['websites'::text, 'presentations'::text, 'docs'::text, 'brand'::text]));