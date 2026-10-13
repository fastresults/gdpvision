CREATE INDEX IF NOT EXISTS narrative_feed_items_signal_id_idx ON public.narrative_feed_items (signal_id);
CREATE INDEX IF NOT EXISTS intake_items_duplicate_of_idx ON public.intake_items (duplicate_of);
CREATE INDEX IF NOT EXISTS comms_artifacts_signal_id_idx ON public.comms_artifacts (signal_id);