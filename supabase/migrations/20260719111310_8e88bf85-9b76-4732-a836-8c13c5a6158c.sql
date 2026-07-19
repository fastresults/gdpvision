
CREATE TABLE public.sector_dossier_briefs (
  country_code text NOT NULL,
  sector_code text NOT NULL,
  brief jsonb NOT NULL,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  context_hash text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (country_code, sector_code)
);

GRANT SELECT ON public.sector_dossier_briefs TO authenticated;
GRANT ALL ON public.sector_dossier_briefs TO service_role;

ALTER TABLE public.sector_dossier_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Country members read sector briefs"
  ON public.sector_dossier_briefs FOR SELECT
  TO authenticated
  USING (public.has_country_access(auth.uid(), country_code));

CREATE TRIGGER update_sector_dossier_briefs_updated_at
  BEFORE UPDATE ON public.sector_dossier_briefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
