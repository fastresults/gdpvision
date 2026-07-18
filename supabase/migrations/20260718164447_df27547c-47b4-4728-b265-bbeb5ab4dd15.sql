CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.intake_items
  ADD COLUMN IF NOT EXISTS story_key text,
  ADD COLUMN IF NOT EXISTS story_primary boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES public.intake_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS intake_items_story_idx
  ON public.intake_items (scope_key, story_key) WHERE story_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS intake_items_topic_trgm_idx
  ON public.intake_items USING gin (topic gin_trgm_ops);