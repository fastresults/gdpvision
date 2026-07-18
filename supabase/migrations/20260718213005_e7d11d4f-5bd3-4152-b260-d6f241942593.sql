
CREATE TABLE public.lever_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','committed','rejected')),
  payload jsonb NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  committed_at timestamptz
);

CREATE INDEX lever_drafts_country_status_idx ON public.lever_drafts (country_code, status, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lever_drafts TO authenticated;
GRANT ALL ON public.lever_drafts TO service_role;

ALTER TABLE public.lever_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lever_drafts readable by country access"
  ON public.lever_drafts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_country_access(auth.uid(), country_code));

CREATE POLICY "lever_drafts writable by steward/admin"
  ON public.lever_drafts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'data_steward'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'data_steward'::public.app_role));

CREATE TRIGGER update_lever_drafts_updated_at
  BEFORE UPDATE ON public.lever_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.levers ADD COLUMN IF NOT EXISTS citations jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.levers ADD COLUMN IF NOT EXISTS rationale text;
ALTER TABLE public.levers ADD COLUMN IF NOT EXISTS draft_id uuid REFERENCES public.lever_drafts(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS levers_country_slug_uidx ON public.levers (country_code, slug);
