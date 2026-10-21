ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS source text;
COMMENT ON COLUMN public.event_registrations.source IS 'null = GDPVision form; partner:<key id> = registered through a partner site via API v2';
CREATE INDEX IF NOT EXISTS event_registrations_source_created_idx ON public.event_registrations (source, created_at);