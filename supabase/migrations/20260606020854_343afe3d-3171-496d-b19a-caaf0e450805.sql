ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_status TEXT NOT NULL DEFAULT 'pending' CHECK (thumbnail_status IN ('pending','processing','ready','failed')),
  ADD COLUMN IF NOT EXISTS thumbnail_error TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_updated_at TIMESTAMPTZ;