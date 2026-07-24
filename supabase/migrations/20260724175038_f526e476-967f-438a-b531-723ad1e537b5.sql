
-- ── opposition_items ─────────────────────────────────────────────────────────
CREATE TABLE public.opposition_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('meme','story','post','screenshot','link','text')),
  title text,
  source_url text,
  storage_path text,
  mime_type text,
  raw_text text,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_channel text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','analyzing','analyzed','failed','archived')),
  status_error text,
  motivation_summary text,
  origin_summary text,
  amplification jsonb NOT NULL DEFAULT '{}'::jsonb,
  themes jsonb NOT NULL DEFAULT '[]'::jsonb,
  severity int,
  sentiment int,
  confidence_grade char(1),
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public')),
  owner_country_code text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX opposition_items_dedup_uidx ON public.opposition_items (
  country_code, COALESCE(storage_path, source_url, md5(COALESCE(raw_text, '')))
);
CREATE INDEX opposition_items_country_created_idx ON public.opposition_items (country_code, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.opposition_items TO authenticated;
GRANT ALL ON public.opposition_items TO service_role;

ALTER TABLE public.opposition_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "opposition_items_country_access"
  ON public.opposition_items FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_country_access(auth.uid(), country_code)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_country_access(auth.uid(), country_code)
  );

CREATE TRIGGER opposition_items_updated_at
  BEFORE UPDATE ON public.opposition_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER opposition_items_enforce_private
  BEFORE INSERT OR UPDATE ON public.opposition_items
  FOR EACH ROW EXECUTE FUNCTION public.enforce_private_ownership();

-- ── opposition_response_plans ────────────────────────────────────────────────
CREATE TABLE public.opposition_response_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.opposition_items(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  posture text CHECK (posture IN ('ignore','clarify','counter','escalate')),
  objective text,
  key_messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  audience_segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  channel_plan jsonb NOT NULL DEFAULT '[]'::jsonb,
  sequenced_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  success_metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  linked_artifact_ids uuid[] NOT NULL DEFAULT '{}',
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence_grade char(1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opposition_response_plans_item_uk UNIQUE (item_id)
);

CREATE INDEX opposition_response_plans_country_idx
  ON public.opposition_response_plans (country_code, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.opposition_response_plans TO authenticated;
GRANT ALL ON public.opposition_response_plans TO service_role;

ALTER TABLE public.opposition_response_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "opposition_response_plans_country_access"
  ON public.opposition_response_plans FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_country_access(auth.uid(), country_code)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_country_access(auth.uid(), country_code)
  );

CREATE TRIGGER opposition_response_plans_updated_at
  BEFORE UPDATE ON public.opposition_response_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
