ALTER TABLE public.programme_decks
  ADD COLUMN IF NOT EXISTS share_token text,
  ADD COLUMN IF NOT EXISTS share_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shared_publicly_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS programme_decks_share_token_key
  ON public.programme_decks (share_token)
  WHERE share_token IS NOT NULL;