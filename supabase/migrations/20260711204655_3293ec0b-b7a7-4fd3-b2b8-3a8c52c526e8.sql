
-- Phase 0 — Instrument foundation

-- Roles ---------------------------------------------------------------
CREATE TYPE public.app_role AS ENUM (
  'admin',
  'principal',
  'steward',
  'advisor',
  'line_minister',
  'comms_director',
  'cabinet_secretary',
  'data_steward'
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  country_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, country_code)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own role rows"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Countries -----------------------------------------------------------
CREATE TABLE public.countries (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  iso3 TEXT,
  currency TEXT NOT NULL DEFAULT 'XCD',
  fiscal_year_start_month SMALLINT NOT NULL DEFAULT 4,
  membership_tier TEXT NOT NULL,
  is_caricom BOOLEAN NOT NULL DEFAULT false,
  is_oecs BOOLEAN NOT NULL DEFAULT false,
  is_cbi_state BOOLEAN NOT NULL DEFAULT false,
  country_pack JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.countries TO anon, authenticated;
GRANT ALL ON public.countries TO service_role;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Registry is public reference"
  ON public.countries FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER trg_countries_updated
  BEFORE UPDATE ON public.countries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sectors -------------------------------------------------------------
CREATE TABLE public.sectors (
  code TEXT PRIMARY KEY,
  index SMALLINT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  isic TEXT,
  hue_token TEXT NOT NULL,
  sort_order SMALLINT NOT NULL
);
GRANT SELECT ON public.sectors TO anon, authenticated;
GRANT ALL ON public.sectors TO service_role;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sector taxonomy is public reference"
  ON public.sectors FOR SELECT TO anon, authenticated USING (true);

-- Country x sector baseline composition -------------------------------
CREATE TABLE public.country_sectors (
  country_code TEXT NOT NULL REFERENCES public.countries(code) ON DELETE CASCADE,
  sector_code TEXT NOT NULL REFERENCES public.sectors(code) ON DELETE RESTRICT,
  share_pct NUMERIC(6,3) NOT NULL,
  confidence_grade CHAR(1) NOT NULL DEFAULT 'C',
  source_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (country_code, sector_code)
);
GRANT SELECT ON public.country_sectors TO anon, authenticated;
GRANT ALL ON public.country_sectors TO service_role;
ALTER TABLE public.country_sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Country composition is public reference"
  ON public.country_sectors FOR SELECT TO anon, authenticated USING (true);
CREATE TRIGGER trg_country_sectors_updated
  BEFORE UPDATE ON public.country_sectors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sources -------------------------------------------------------------
CREATE TABLE public.sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  grade CHAR(1) NOT NULL DEFAULT 'B',
  url TEXT,
  country_code TEXT REFERENCES public.countries(code) ON DELETE SET NULL,
  sector_code TEXT REFERENCES public.sectors(code) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.sources TO authenticated;
GRANT ALL ON public.sources TO service_role;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sources readable by authenticated users"
  ON public.sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "Stewards manage sources"
  ON public.sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'data_steward') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'data_steward') OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_sources_updated
  BEFORE UPDATE ON public.sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed sectors --------------------------------------------------------
INSERT INTO public.sectors (code, index, label, isic, hue_token, sort_order) VALUES
  ('public-administration', 1, 'Public administration', 'O',  '--sector-01', 1),
  ('agriculture',           2, 'Agriculture & fisheries', 'A', '--sector-02', 2),
  ('tourism',               3, 'Tourism', 'I',              '--sector-03', 3),
  ('construction',          4, 'Construction', 'F',         '--sector-04', 4),
  ('transport',             5, 'Transport & logistics', 'H','--sector-05', 5),
  ('blue-economy',          6, 'Blue economy', 'B',         '--sector-06', 6),
  ('manufacturing',         7, 'Manufacturing', 'C',        '--sector-07', 7),
  ('energy',                8, 'Energy', 'D',               '--sector-08', 8),
  ('digital',               9, 'Digital economy', 'J',      '--sector-09', 9),
  ('financial',            10, 'Financial services', 'K',   '--sector-10', 10),
  ('real-estate',          11, 'Real estate', 'L',          '--sector-11', 11),
  ('other-services',       12, 'Other services', 'S',       '--sector-12', 12);

-- Seed countries (CARICOM + OECS registry) ----------------------------
INSERT INTO public.countries (code, name, iso3, currency, fiscal_year_start_month, membership_tier, is_caricom, is_oecs, is_cbi_state, country_pack) VALUES
  ('ATG', 'Antigua & Barbuda', 'ATG', 'XCD', 4, 'caricom-full', true, true, true,
    '{"nso":"Statistics Division of Antigua and Barbuda","central_bank":"ECCB","portfolio_map":{"tourism":"Ministry of Tourism","financial":"Ministry of Finance","construction":"Ministry of Works","blue-economy":"Ministry of the Blue Economy"}}'::jsonb),
  ('BHS', 'The Bahamas', 'BHS', 'BSD', 7, 'caricom-full', true, false, false, '{}'::jsonb),
  ('BRB', 'Barbados', 'BRB', 'BBD', 4, 'caricom-full', true, false, false, '{}'::jsonb),
  ('BLZ', 'Belize', 'BLZ', 'BZD', 4, 'caricom-full', true, false, false, '{}'::jsonb),
  ('DMA', 'Dominica', 'DMA', 'XCD', 7, 'caricom-full', true, true, true,
    '{"nso":"Central Statistical Office of Dominica","central_bank":"ECCB"}'::jsonb),
  ('GRD', 'Grenada', 'GRD', 'XCD', 1, 'caricom-full', true, true, true,
    '{"nso":"Central Statistical Office of Grenada","central_bank":"ECCB"}'::jsonb),
  ('GUY', 'Guyana', 'GUY', 'GYD', 1, 'caricom-full', true, false, false, '{}'::jsonb),
  ('HTI', 'Haiti', 'HTI', 'HTG', 10, 'caricom-full', true, false, false, '{"language":"fr"}'::jsonb),
  ('JAM', 'Jamaica', 'JAM', 'JMD', 4, 'caricom-full', true, false, false, '{}'::jsonb),
  ('MSR', 'Montserrat', 'MSR', 'XCD', 4, 'caricom-full', true, true, false, '{"central_bank":"ECCB"}'::jsonb),
  ('KNA', 'St. Kitts & Nevis', 'KNA', 'XCD', 1, 'caricom-full', true, true, true,
    '{"nso":"Department of Statistics of St. Kitts and Nevis","central_bank":"ECCB"}'::jsonb),
  ('LCA', 'Saint Lucia', 'LCA', 'XCD', 4, 'caricom-full', true, true, false,
    '{"nso":"Central Statistical Office of Saint Lucia","central_bank":"ECCB","language":"en"}'::jsonb),
  ('VCT', 'St. Vincent & the Grenadines', 'VCT', 'XCD', 1, 'caricom-full', true, true, false, '{"central_bank":"ECCB"}'::jsonb),
  ('SUR', 'Suriname', 'SUR', 'SRD', 1, 'caricom-full', true, false, false, '{"language":"nl"}'::jsonb),
  ('TTO', 'Trinidad & Tobago', 'TTO', 'TTD', 10, 'caricom-full', true, false, false, '{}'::jsonb),
  ('AIA', 'Anguilla', 'AIA', 'XCD', 4, 'caricom-associate', true, true, false, '{"central_bank":"ECCB"}'::jsonb),
  ('BMU', 'Bermuda', 'BMU', 'BMD', 4, 'caricom-associate', true, false, false, '{}'::jsonb),
  ('VGB', 'British Virgin Islands', 'VGB', 'USD', 4, 'caricom-associate', true, true, false, '{"central_bank":"ECCB"}'::jsonb),
  ('CYM', 'Cayman Islands', 'CYM', 'KYD', 1, 'caricom-associate', true, false, false, '{}'::jsonb),
  ('TCA', 'Turks & Caicos Islands', 'TCA', 'USD', 4, 'caricom-associate', true, false, false, '{}'::jsonb),
  ('MTQ', 'Martinique', 'MTQ', 'EUR', 1, 'oecs-associate', false, true, false, '{"language":"fr"}'::jsonb),
  ('GLP', 'Guadeloupe', 'GLP', 'EUR', 1, 'oecs-associate', false, true, false, '{"language":"fr"}'::jsonb);

-- Seed idealized balanced composition for the 5 CBI states (Phase 1 loads real Ledger figures)
INSERT INTO public.country_sectors (country_code, sector_code, share_pct, confidence_grade, source_ref)
SELECT c.code, s.code, ROUND(100.0/12, 3), 'D', 'Phase 0 balanced seed — replace in Phase 1 Ledger load'
FROM public.countries c
CROSS JOIN public.sectors s
WHERE c.is_cbi_state = true;
