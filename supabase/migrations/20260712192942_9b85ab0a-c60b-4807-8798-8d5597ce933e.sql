ALTER TABLE public.ministry_profiles
  ADD COLUMN IF NOT EXISTS minister_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS citations jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.ministry_profiles
SET minister_profile = jsonb_build_object('name', minister)
WHERE (minister_profile IS NULL OR minister_profile = '{}'::jsonb)
  AND minister IS NOT NULL
  AND minister <> '';