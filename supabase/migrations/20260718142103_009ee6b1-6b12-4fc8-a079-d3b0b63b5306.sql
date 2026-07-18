
ALTER TABLE public.intake_items
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS scope text CHECK (scope IN ('local','regional','international')),
  ADD COLUMN IF NOT EXISTS severity smallint CHECK (severity BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS reach smallint CHECK (reach BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS sentiment smallint CHECK (sentiment BETWEEN -2 AND 2),
  ADD COLUMN IF NOT EXISTS recommendation text CHECK (recommendation IN ('lead','amplify','counter','monitor','ignore'));

CREATE INDEX IF NOT EXISTS intake_items_scope_key_state_idx ON public.intake_items (scope_key, state, created_at DESC);

ALTER TABLE public.comms_artifacts
  ADD COLUMN IF NOT EXISTS signal_id uuid,
  ADD COLUMN IF NOT EXISTS published_url text,
  ADD COLUMN IF NOT EXISTS published_at timestamp with time zone;
