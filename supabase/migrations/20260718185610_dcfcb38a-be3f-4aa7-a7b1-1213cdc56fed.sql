
-- Chamber 06: Cabinet Room additions

CREATE TABLE public.cabinet_agenda_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.cabinet_sessions(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  ordinal INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  sponsor_ministry_id UUID REFERENCES public.ministries(id) ON DELETE SET NULL,
  classification TEXT NOT NULL DEFAULT 'restricted' CHECK (classification IN ('public','internal','restricted','secret')),
  time_box_min INTEGER NOT NULL DEFAULT 10,
  recommendation TEXT,
  motion_kind TEXT NOT NULL DEFAULT 'approve' CHECK (motion_kind IN ('approve','note','refer','defer')),
  brief_md TEXT,
  dossier JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','presenting','decided','skipped')),
  readiness_score INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cabinet_agenda_items TO authenticated;
GRANT ALL ON public.cabinet_agenda_items TO service_role;
ALTER TABLE public.cabinet_agenda_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cabinet_agenda_items country access" ON public.cabinet_agenda_items FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));
CREATE INDEX cabinet_agenda_items_session_idx ON public.cabinet_agenda_items(session_id, ordinal);
CREATE TRIGGER cabinet_agenda_items_updated_at BEFORE UPDATE ON public.cabinet_agenda_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cabinet_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.cabinet_sessions(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  attendee_name TEXT NOT NULL,
  role TEXT,
  is_chair BOOLEAN NOT NULL DEFAULT false,
  present BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cabinet_attendance TO authenticated;
GRANT ALL ON public.cabinet_attendance TO service_role;
ALTER TABLE public.cabinet_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cabinet_attendance country access" ON public.cabinet_attendance FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));

CREATE TABLE public.cabinet_votes (
  agenda_item_id UUID NOT NULL PRIMARY KEY REFERENCES public.cabinet_agenda_items(id) ON DELETE CASCADE,
  country_code TEXT NOT NULL,
  for_count INTEGER NOT NULL DEFAULT 0,
  against_count INTEGER NOT NULL DEFAULT 0,
  abstain_count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cabinet_votes TO authenticated;
GRANT ALL ON public.cabinet_votes TO service_role;
ALTER TABLE public.cabinet_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cabinet_votes country access" ON public.cabinet_votes FOR ALL TO authenticated
  USING (public.has_country_access(auth.uid(), country_code))
  WITH CHECK (public.has_country_access(auth.uid(), country_code));
CREATE TRIGGER cabinet_votes_updated_at BEFORE UPDATE ON public.cabinet_votes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.decisions
  ADD COLUMN IF NOT EXISTS agenda_item_id UUID REFERENCES public.cabinet_agenda_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motion_kind TEXT,
  ADD COLUMN IF NOT EXISTS classification TEXT NOT NULL DEFAULT 'restricted',
  ADD COLUMN IF NOT EXISTS duration_sec INTEGER;

ALTER TABLE public.commitments
  ADD COLUMN IF NOT EXISTS agenda_item_id UUID REFERENCES public.cabinet_agenda_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS success_metric TEXT,
  ADD COLUMN IF NOT EXISTS sector_code TEXT;

ALTER TABLE public.cabinet_sessions
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS chair_name TEXT,
  ADD COLUMN IF NOT EXISTS chair_signed_at TIMESTAMPTZ;
