CREATE TABLE public.figure_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  figure_kind text NOT NULL CHECK (figure_kind IN ('sector_share','cbi_exposure','series_point','composition_total','capital_flow')),
  figure_ref jsonb NOT NULL,
  value numeric,
  unit text,
  confidence_grade char(1),
  source_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_explanation text,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  scope text NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal','scenario','brief')),
  scope_ref uuid,
  note text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX figure_snapshots_country_idx ON public.figure_snapshots(country_code, created_at DESC);
CREATE INDEX figure_snapshots_user_idx ON public.figure_snapshots(created_by, created_at DESC);
CREATE INDEX figure_snapshots_scope_idx ON public.figure_snapshots(scope, scope_ref);

GRANT SELECT, INSERT, DELETE ON public.figure_snapshots TO authenticated;
GRANT ALL ON public.figure_snapshots TO service_role;

ALTER TABLE public.figure_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own snapshots readable" ON public.figure_snapshots
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_country_role(auth.uid(), 'data_steward'::public.app_role, country_code)
  );

CREATE POLICY "signed in users create own snapshots" ON public.figure_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "admins delete snapshots" ON public.figure_snapshots
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Enforce immutability: no UPDATE policy means no row can be modified.
