
CREATE TABLE public.dossier_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id uuid NOT NULL REFERENCES public.intake_items(id) ON DELETE CASCADE,
  scope_key text NOT NULL,
  sector_code text,
  question text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','dismissed')),
  answer_ref text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dossier_questions TO authenticated;
GRANT ALL ON public.dossier_questions TO service_role;
ALTER TABLE public.dossier_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dossier_questions readable by authenticated"
  ON public.dossier_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "dossier_questions writable by admins"
  ON public.dossier_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX dossier_questions_signal_idx ON public.dossier_questions(signal_id);
CREATE TRIGGER update_dossier_questions_updated_at
  BEFORE UPDATE ON public.dossier_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.narrative_lineage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id uuid REFERENCES public.intake_items(id) ON DELETE SET NULL,
  artifact_type text NOT NULL CHECK (artifact_type IN ('strategy','comms','counsel')),
  artifact_id uuid NOT NULL,
  scope_key text NOT NULL,
  sector_code text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.narrative_lineage TO authenticated;
GRANT ALL ON public.narrative_lineage TO service_role;
ALTER TABLE public.narrative_lineage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "narrative_lineage readable by authenticated"
  ON public.narrative_lineage FOR SELECT TO authenticated USING (true);
CREATE POLICY "narrative_lineage writable by admins"
  ON public.narrative_lineage FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX narrative_lineage_signal_idx ON public.narrative_lineage(signal_id);
CREATE INDEX narrative_lineage_artifact_idx ON public.narrative_lineage(artifact_type, artifact_id);
